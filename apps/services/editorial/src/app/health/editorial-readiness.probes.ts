import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createConnection, type RowDataPacket } from 'mysql2';
import { MongoClient } from 'mongodb';
import {
  EDITORIAL_PROJECTION_QUEUE,
  EDITORIAL_PROJECTION_FAILED_QUEUE,
} from '@apps/shared';
import { EDITORIAL_MIGRATIONS } from '../editorial-migrations';
import { CLASSIFICATION_TABLES } from '../content-classification/content-classification-schema';
import type { QueueObservation, ReadinessCheck } from './editorial-readiness';

class IncompatibleSchema extends Error {}
const httpOptions = () => ({
  timeout: 1200,
  signal: AbortSignal.timeout(1400),
  maxRedirects: 0,
  maxContentLength: 32_768,
  proxy: false as const,
});

@Injectable()
export class EditorialReadinessProbes {
  constructor(private readonly config: ConfigService) {}

  async sql(
    maxAge: number
  ): Promise<Record<'sql' | 'schema' | 'outbox', ReadinessCheck>> {
    const checks = {
      sql: { code: 'sql_unavailable' },
      schema: { code: 'not_checked' },
      outbox: { code: 'not_checked' },
    };
    let connection: ReturnType<typeof createConnection> | undefined;
    let deadline: NodeJS.Timeout | undefined;
    try {
      connection = createConnection({
        host: this.required('EDITORIAL_DATABASE_HOST'),
        port: Number(this.required('EDITORIAL_DATABASE_PORT')),
        user: this.required('EDITORIAL_DATABASE_USERNAME'),
        password: this.required('EDITORIAL_DATABASE_PASSWORD'),
        database: this.required('EDITORIAL_DATABASE_NAME'),
        connectTimeout: 800,
      });
      // Destroy the dedicated probe socket on the total deadline, including a stalled handshake/query.
      const socket = connection;
      const expired = new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          socket.destroy();
          reject(new Error('Probe deadline'));
        }, 1500);
      });
      const query = async (sql: string, values: unknown[] = []) => {
        const [rows] = await Promise.race([
          socket
            .promise()
            .query<RowDataPacket[]>({ sql, timeout: 500 }, values),
          expired,
        ]);
        return rows;
      };
      await query('SELECT 1');
      checks.sql.code = 'ok';
      const migrations = await query(
        'SELECT /*+ MAX_EXECUTION_TIME(500) */ name FROM editorial_migrations LIMIT 100'
      );
      if (
        migrations.length !== EDITORIAL_MIGRATIONS.length ||
        EDITORIAL_MIGRATIONS.some(
          (migration) => !migrations.some((row) => row.name === migration.name)
        )
      )
        throw new IncompatibleSchema();
      const columns = await query(
        `SELECT /*+ MAX_EXECUTION_TIME(500) */ TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS nullable, COLLATION_NAME AS collation, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra
        FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${CLASSIFICATION_TABLES.map(
          () => '?'
        ).join(',')}) AND COLUMN_NAME='classification'`,
        [...CLASSIFICATION_TABLES]
      );
      if (
        columns.length !== CLASSIFICATION_TABLES.length ||
        columns.some(
          (row) =>
            row.columnType !== 'varchar(7)' ||
            row.nullable !== 'YES' ||
            row.collation !== 'utf8mb4_bin' ||
            row.defaultValue !== null ||
            row.extra !== ''
        )
      )
        throw new IncompatibleSchema();
      const requiredTables = [
        ...CLASSIFICATION_TABLES,
        'editorial_resource_states',
        'editorial_outbox',
        'categories',
        'tags',
      ];
      const tables = await query(
        `SELECT /*+ MAX_EXECUTION_TIME(500) */ ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${requiredTables
          .map(() => '?')
          .join(',')})`,
        requiredTables
      );
      if (
        tables.length !== requiredTables.length ||
        tables.some((row) => row.engine !== 'InnoDB')
      )
        throw new IncompatibleSchema();
      const authority =
        await query(`SELECT /*+ MAX_EXECUTION_TIME(500) */ TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS nullable
        FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('app_records','categories','tags','editorial_resource_states','editorial_outbox') LIMIT 256`);
      const signature = [
        ...['app_records', 'categories', 'tags'].flatMap((table) => [
          [table, 'id', 'varchar(36)', 'NO'],
          [table, 'slug', 'varchar(255)', 'NO'],
        ]),
        ...[
          ['resourceKind', 'varchar(16)', 'NO'],
          ['resourceId', 'varchar(36)', 'NO'],
          ['tenantId', 'varchar(128)', 'NO'],
          ['revision', 'bigint unsigned', 'NO'],
          ['deletedAt', 'bigint', 'YES'],
        ].map((column) => ['editorial_resource_states', ...column]),
        ...[
          ['id', 'bigint unsigned', 'NO'],
          ['createdAt', 'bigint', 'NO'],
          ['availableAt', 'bigint', 'NO'],
          ['leasedUntil', 'bigint', 'YES'],
          ['deliveredAt', 'bigint', 'YES'],
          ['failedAt', 'bigint', 'YES'],
        ].map((column) => ['editorial_outbox', ...column]),
      ];
      if (
        signature.some(
          ([table, name, type, nullable]) =>
            !authority.some(
              (column) =>
                column.tableName === table &&
                column.columnName === name &&
                column.columnType === type &&
                column.nullable === nullable
            )
        )
      )
        throw new IncompatibleSchema();
      // Resolve the actual journey's authoritative columns without reading business rows.
      await query(
        'SELECT a.id,a.slug,a.classification,s.resourceKind,s.resourceId,s.tenantId,s.revision,s.deletedAt FROM app_records a JOIN editorial_resource_states s ON s.resourceId=a.id LIMIT 0'
      );
      checks.schema.code = 'ok';
      const [row] = await query(
        `SELECT /*+ MAX_EXECUTION_TIME(500) */
        COALESCE(SUM(failedAt IS NULL),0) AS pending, COALESCE(SUM(failedAt IS NOT NULL),0) AS failed,
        MIN(CASE WHEN failedAt IS NULL THEN createdAt END) AS oldest,
        COALESCE(SUM(failedAt IS NULL AND leasedUntil < ?),0) AS expired
        FROM (SELECT failedAt,createdAt,leasedUntil FROM editorial_outbox WHERE deliveredAt IS NULL ORDER BY id LIMIT 1001) pending`,
        [Date.now()]
      );
      const oldestPendingMs =
        row.oldest === null ? 0 : Math.max(0, Date.now() - Number(row.oldest));
      if (
        ![
          Number(row.pending),
          Number(row.failed),
          Number(row.expired),
          oldestPendingMs,
        ].every((value) => Number.isSafeInteger(value) && value >= 0)
      )
        throw new IncompatibleSchema();
      checks.outbox = {
        code:
          Number(row.failed) > 0
            ? 'poison_messages'
            : oldestPendingMs >= maxAge
            ? 'dispatch_backlog'
            : 'ok',
        ...{
          pending: Number(row.pending),
          failed: Number(row.failed),
          oldestPendingMs,
          expiredLeases: Number(row.expired),
        },
      };
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;
      if (
        error instanceof IncompatibleSchema ||
        ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(String(code))
      )
        checks.schema.code = 'schema_incompatible';
      else checks.sql.code = 'sql_unavailable';
    } finally {
      if (deadline) clearTimeout(deadline);
      connection?.destroy();
    }
    return checks;
  }

  async projection(): Promise<ReadinessCheck> {
    let client: MongoClient | undefined;
    try {
      const signal = AbortSignal.timeout(1400);
      client = new MongoClient(
        `mongodb://${this.required('MONGO_HOST')}:${this.required(
          'MONGO_PORT'
        )}`,
        {
          auth: {
            username: this.required('MONGO_USERNAME'),
            password: this.required('MONGO_PASSWORD'),
          },
          authSource: 'admin',
          serverSelectionTimeoutMS: 800,
          connectTimeoutMS: 800,
          socketTimeoutMS: 800,
          waitQueueTimeoutMS: 500,
          timeoutMS: 1200,
          maxPoolSize: 1,
        }
      );
      const db = client.db(this.required('MONGO_DATABASE'));
      const collections = await db
        .listCollections(
          { name: 'editorial_projections_v1' },
          { nameOnly: true, maxTimeMS: 500, signal }
        )
        .toArray();
      if (collections.length !== 1) return { code: 'projection_missing' };
      await db
        .collection('editorial_projections_v1')
        .findOne({}, { projection: { _id: 1 }, maxTimeMS: 500, signal });
      return { code: 'ok' };
    } catch {
      return { code: 'projection_unavailable' };
    } finally {
      await client?.close();
    }
  }

  async policy(): Promise<ReadinessCheck> {
    try {
      const response = await axios.post(
        `${this.required('OPA_URL').replace(
          /\/$/,
          ''
        )}/v1/data/wapps/editorial/authz/allow`,
        { input: {} },
        httpOptions()
      );
      return {
        code: response.data?.result === false ? 'ok' : 'policy_incompatible',
      };
    } catch {
      return { code: 'policy_unavailable' };
    }
  }

  async queue(): Promise<QueueObservation | ReadinessCheck> {
    try {
      const origin =
        this.config.get<string>('EDITORIAL_READINESS_QUEUE_URL') ??
        `http://${this.required('QUEUE_HOST')}:15672`;
      const vhost = encodeURIComponent(
        this.config.get<string>('QUEUE_VHOST') ?? '/'
      );
      const read = async (name: string) =>
        (
          await axios.get(
            `${origin.replace(
              /\/$/,
              ''
            )}/api/queues/${vhost}/${encodeURIComponent(name)}`,
            {
              ...httpOptions(),
              auth: {
                username: this.required('QUEUE_USERNAME'),
                password: this.required('QUEUE_PASSWORD'),
              },
            }
          )
        ).data;
      const [queue, failed] = await Promise.all([
        read(EDITORIAL_PROJECTION_QUEUE),
        read(EDITORIAL_PROJECTION_FAILED_QUEUE),
      ]);
      const value = {
        pending: queue.messages_ready,
        unacknowledged: queue.messages_unacknowledged,
        consumers: queue.consumers,
        failed: failed.messages,
        acknowledged: queue.message_stats?.ack ?? 0,
      };
      if (!Object.values(value).every((n) => Number.isSafeInteger(n) && n >= 0))
        return { code: 'queue_incompatible' };
      return value;
    } catch (error) {
      return {
        code:
          axios.isAxiosError(error) && error.response?.status === 404
            ? 'queue_missing'
            : 'queue_unavailable',
      };
    }
  }

  private required(name: string): string {
    return this.config.getOrThrow<string>(name);
  }
}
