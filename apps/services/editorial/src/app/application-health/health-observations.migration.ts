import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  ensureJournalTable,
  type JournalTableDefinition,
} from '@sdk/extras/mysql';

export class HealthObservations1791840018000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasTable('editorial_resource_states')))
      throw new Error('Health observations require canonical applications');
    const varchar = (length: number) => ({
      type: `varchar(${length})`,
      collation: 'utf8mb4_bin',
    });
    const integer = { type: 'bigint unsigned' };
    const tables: Omit<JournalTableDefinition, 'migration'>[] = [
      {
        name: 'health_monitors',
        create: `CREATE TABLE health_monitors (
          id varchar(36) COLLATE utf8mb4_bin NOT NULL, applicationId varchar(36) COLLATE utf8mb4_bin NOT NULL,
          tenantId varchar(128) COLLATE utf8mb4_bin NOT NULL, revision bigint unsigned NOT NULL,
          name varchar(80) COLLATE utf8mb4_bin NOT NULL, url varchar(2048) COLLATE utf8mb4_bin NOT NULL,
          enabled tinyint unsigned NOT NULL,
          PRIMARY KEY(id), KEY health_application(tenantId,applicationId,id), KEY health_schedule(tenantId,enabled,id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
        columns: {
          id: varchar(36),
          applicationId: varchar(36),
          tenantId: varchar(128),
          revision: integer,
          name: varchar(80),
          url: varchar(2048),
          enabled: { type: 'tinyint unsigned' },
        },
        indexes: {
          PRIMARY: { columns: ['id'], unique: true },
          health_application: {
            columns: ['tenantId', 'applicationId', 'id'],
            unique: false,
          },
          health_schedule: {
            columns: ['tenantId', 'enabled', 'id'],
            unique: false,
          },
        },
      },
      {
        name: 'health_monitor_versions',
        create: `CREATE TABLE health_monitor_versions (
          monitorId varchar(36) COLLATE utf8mb4_bin NOT NULL, revision bigint unsigned NOT NULL,
          applicationRevision bigint unsigned NOT NULL, configuration json NOT NULL,
          PRIMARY KEY(monitorId,revision)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
        columns: {
          monitorId: varchar(36),
          revision: integer,
          applicationRevision: integer,
          configuration: { type: 'json' },
        },
        indexes: {
          PRIMARY: { columns: ['monitorId', 'revision'], unique: true },
        },
      },
      {
        name: 'health_observations',
        create: `CREATE TABLE health_observations (
          monitorId varchar(36) COLLATE utf8mb4_bin NOT NULL, configurationRevision bigint unsigned NOT NULL,
          slotAt bigint unsigned NOT NULL, leaseId varchar(36) COLLATE utf8mb4_bin NOT NULL,
          leaseUntil bigint unsigned NOT NULL, attempts tinyint unsigned NOT NULL, observation json NULL,
          PRIMARY KEY(monitorId,configurationRevision,slotAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
        columns: {
          monitorId: varchar(36),
          configurationRevision: integer,
          slotAt: integer,
          leaseId: varchar(36),
          leaseUntil: integer,
          attempts: { type: 'tinyint unsigned' },
          observation: { type: 'json', nullable: true },
        },
        indexes: {
          PRIMARY: {
            columns: ['monitorId', 'configurationRevision', 'slotAt'],
            unique: true,
          },
        },
      },
    ];
    for (const table of tables)
      await ensureJournalTable(runner, {
        ...table,
        migration: this.constructor.name,
      });
    const invalid =
      await runner.query(`SELECT m.id FROM health_monitors m LEFT JOIN health_monitor_versions v ON v.monitorId=m.id AND v.revision=m.revision
      LEFT JOIN editorial_resource_states a ON a.resourceKind='app' AND a.resourceId=m.applicationId AND a.tenantId=m.tenantId
      WHERE v.monitorId IS NULL OR a.resourceId IS NULL OR m.revision<1 OR m.enabled NOT IN (0,1) LIMIT 1`);
    if (invalid.length)
      throw new Error('Inconsistent canonical health monitors');
    const orphan =
      await runner.query(`SELECT o.monitorId FROM health_observations o LEFT JOIN health_monitor_versions v ON v.monitorId=o.monitorId AND v.revision=o.configurationRevision
      WHERE v.monitorId IS NULL OR MOD(o.slotAt,300000)<>0 OR o.attempts NOT BETWEEN 1 AND 3 LIMIT 1`);
    if (orphan.length)
      throw new Error('Inconsistent canonical health observations');
  }
  async down(): Promise<void> {
    throw new Error(
      'Health observations and configuration revisions are authoritative; use a reviewed forward migration'
    );
  }
}
