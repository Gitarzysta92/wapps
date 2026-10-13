import type { MigrationInterface, QueryRunner } from 'typeorm';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import { canonicalArticle } from '../articles/mysql-article-state';
import { readReleasePublicationSnapshot } from '../releases/mysql-release-snapshot';
import { readSuitePublicationSnapshot } from '../suites/mysql-suite-snapshot';
import {
  editorialSqlInteger,
  MysqlEditorialSnapshotReader,
} from '../infrastructure/mysql-editorial-snapshot';
import { editorialAuthorErasureApplied } from './editorial-erasure-schema';

type Row = Record<string, unknown>;
const tableName = 'editorial_erasure_resources';
const ownership = [
  ['editorial_resource_states', 'ownerIdentityId'],
  ['editorial_outbox', 'actorIdentityId'],
  ['article_publications', 'ownerIdentityId'],
] as const;
const targetColumns = [
  ['identityId', 'varchar', '128'],
  ['erasureRevision', 'bigint', ''],
  ['resourceKind', 'varchar', '16'],
  ['resourceId', 'varchar', '36'],
  ['projectionRevision', 'bigint', ''],
] as const;
const kinds = [
  'app',
  'category',
  'tag',
  'suite',
  'article',
  'release',
] as const;

/** Keep canonical null ownership and durable projection targets through retries and restore. */
export class EditorialAuthorErasure1791840010000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    for (const name of [
      'editorial_resource_states',
      'editorial_outbox',
      'article_publications',
      'suite_publications',
      'release_publications',
      'identity_erasure_barriers',
      'identity_erasure_requests',
    ])
      if (!(await runner.hasTable(name)))
        throw new Error(`Editorial author erasure requires ${name}`);
    const applied = await editorialAuthorErasureApplied(runner);
    const missingNullable: (typeof ownership)[number][] = [];
    for (const entry of ownership) {
      const [table, name] = entry;
      const column = (await runner.getTable(table))?.findColumnByName(name);
      const [meta]: Row[] = await runner.query(
        'SELECT t.ENGINE AS engine,c.COLLATION_NAME AS collation,c.CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=? AND c.COLUMN_NAME=?',
        [table, name]
      );
      if (
        !column ||
        column.type !== 'varchar' ||
        column.isPrimary ||
        column.isGenerated ||
        meta?.engine !== 'InnoDB' ||
        meta.collation !== 'utf8mb4_bin' ||
        Number(meta.length) !== 128
      )
        throw new Error(
          `Incompatible Editorial anonymous identity: ${table}.${name}`
        );
      if (!column.isNullable) {
        if (applied)
          throw new Error(
            'Applied Editorial anonymous identity schema is missing'
          );
        missingNullable.push(entry);
      }
    }
    const targetsExist = await runner.hasTable(tableName);
    if (targetsExist) await this.targetsSchema(runner);
    else if (applied)
      throw new Error('Applied Editorial erasure targets are missing');
    const indexed = await this.index(
      runner,
      'editorial_resource_states',
      'idx_editorial_erasure_owner',
      ['ownerIdentityId', 'resourceKind', 'resourceId'],
      false,
      !applied
    );
    // Validate all existing authority before MySQL commits any DDL.
    await this.authority(runner, applied);
    if (targetsExist) await this.targets(runner);
    for (const [table, name] of missingNullable)
      await runner.query(
        `ALTER TABLE ${table} MODIFY ${name} varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL`
      );
    if (!targetsExist)
      await runner.query(`CREATE TABLE editorial_erasure_resources (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        erasureRevision bigint UNSIGNED NOT NULL,
        resourceKind varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        resourceId varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        projectionRevision bigint UNSIGNED NOT NULL,
        PRIMARY KEY (identityId,resourceKind,resourceId)
      ) ENGINE=InnoDB`);
    if (!indexed)
      await runner.query(
        'CREATE INDEX idx_editorial_erasure_owner ON editorial_resource_states (ownerIdentityId,resourceKind,resourceId)'
      );
    await this.targetsSchema(runner);
    await this.index(
      runner,
      'editorial_resource_states',
      'idx_editorial_erasure_owner',
      ['ownerIdentityId', 'resourceKind', 'resourceId'],
      false,
      false
    );
  }

  private async index(
    runner: QueryRunner,
    table: string,
    name: string,
    columns: string[],
    unique: boolean,
    missing: boolean
  ) {
    const rows: Row[] = await runner.query(
      'SELECT COLUMN_NAME AS name,SUB_PART AS prefix,NON_UNIQUE AS nonUnique,COLLATION AS direction,IS_VISIBLE AS visible,EXPRESSION AS expression FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX',
      [table, name]
    );
    if (!rows.length && missing) return false;
    if (
      rows.length !== columns.length ||
      rows.some(
        (row, i) =>
          row.name !== columns[i] ||
          row.prefix !== null ||
          Number(row.nonUnique) !== (unique ? 0 : 1) ||
          row.direction !== 'A' ||
          row.visible !== 'YES' ||
          row.expression !== null
      )
    )
      throw new Error(`Incompatible Editorial erasure index: ${table}.${name}`);
    return true;
  }

  private async targetsSchema(runner: QueryRunner) {
    const table = await runner.getTable(tableName);
    const info: Row[] = await runner.query(
      'SELECT c.COLUMN_NAME AS name,t.ENGINE AS engine,c.COLLATION_NAME AS collation,c.CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=?',
      [tableName]
    );
    const triggers: Row[] = await runner.query(
      'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=?',
      [tableName]
    );
    if (
      !table ||
      table.columns.length !== targetColumns.length ||
      table.foreignKeys.length ||
      triggers.length
    )
      throw new Error('Incompatible Editorial erasure targets schema');
    for (const [name, type, length] of targetColumns) {
      const column = table.findColumnByName(name),
        meta = info.find((row) => row.name === name);
      if (
        !column ||
        column.type !== type ||
        column.isNullable ||
        column.isGenerated ||
        column.unsigned !== (type === 'bigint') ||
        meta?.engine !== 'InnoDB' ||
        meta.collation !== (type === 'bigint' ? null : 'utf8mb4_bin') ||
        (type === 'varchar' && String(meta.length) !== length)
      )
        throw new Error(`Incompatible Editorial erasure target: ${name}`);
    }
    await this.index(
      runner,
      tableName,
      'PRIMARY',
      ['identityId', 'resourceKind', 'resourceId'],
      true,
      false
    );
  }

  private async authority(runner: QueryRunner, anonymous: boolean) {
    let after = ['', ''];
    for (;;) {
      const rows: Row[] = await runner.query(
        'SELECT * FROM editorial_resource_states WHERE (resourceKind,resourceId)>(?,?) ORDER BY resourceKind,resourceId LIMIT 128',
        after
      );
      for (const row of rows) {
        if (
          !isEditorialResourceId(row.resourceId) ||
          !isEditorialScope(row.tenantId) ||
          !(
            isEditorialScope(row.ownerIdentityId) ||
            (anonymous && row.ownerIdentityId === null)
          ) ||
          !kinds.some((kind) => kind === row.resourceKind)
        )
          throw new Error('Invalid Editorial anonymous authority');
        editorialSqlInteger(row.revision, 1);
        if (row.deletedAt !== null) editorialSqlInteger(row.deletedAt);
        const kind = row.resourceKind as (typeof kinds)[number];
        if (kind === 'article') {
          if (!(await canonicalArticle(runner.manager, row.resourceId)))
            throw new Error('Missing article erasure authority');
        } else if (kind === 'release')
          await readReleasePublicationSnapshot(runner.manager, row.resourceId);
        else if (kind === 'suite')
          await readSuitePublicationSnapshot(runner.manager, row.resourceId);
        else
          await new MysqlEditorialSnapshotReader(
            runner.connection,
            row.tenantId
          ).readValues(runner.manager, kind, row.resourceId, row);
        after = [kind, row.resourceId];
      }
      if (rows.length < 128) return;
    }
  }

  private async targets(runner: QueryRunner) {
    let after = ['', '', ''];
    for (;;) {
      const rows: Row[] = await runner.query(
        `SELECT t.*,s.ownerIdentityId,s.revision AS currentRevision,b.erasureRevision AS barrierRevision,b.requestedAt AS barrierAt,r.revision AS requestRevision,r.requestedAt,r.completedAt
        FROM editorial_erasure_resources t LEFT JOIN editorial_resource_states s ON s.resourceKind=t.resourceKind AND s.resourceId=t.resourceId
        LEFT JOIN identity_erasure_barriers b ON b.identityId=t.identityId LEFT JOIN identity_erasure_requests r ON r.identityId=t.identityId
        WHERE (t.identityId,t.resourceKind,t.resourceId)>(?,?,?) ORDER BY t.identityId,t.resourceKind,t.resourceId LIMIT 128`,
        after
      );
      for (const row of rows) {
        if (
          !isCanonicalIdentityId(row.identityId) ||
          !isEditorialResourceId(row.resourceId) ||
          !kinds.some((kind) => kind === row.resourceKind) ||
          row.ownerIdentityId === row.identityId ||
          editorialSqlInteger(row.currentRevision, 1) <
            editorialSqlInteger(row.projectionRevision, 2) ||
          editorialSqlInteger(row.erasureRevision, 1) !==
            editorialSqlInteger(row.barrierRevision, 1) ||
          editorialSqlInteger(row.erasureRevision, 1) !==
            editorialSqlInteger(row.requestRevision, 1) ||
          editorialSqlInteger(row.requestedAt, 1) !==
            editorialSqlInteger(row.barrierAt, 1) ||
          row.completedAt !== null ||
          (row.ownerIdentityId !== null &&
            Number(row.currentRevision) === Number(row.projectionRevision))
        )
          throw new Error('Invalid Editorial erasure target authority');
        after = [row.identityId, String(row.resourceKind), row.resourceId];
      }
      if (rows.length < 128) return;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Editorial anonymity and cleanup targets require a reviewed data-preserving rollback'
    );
  }
}
