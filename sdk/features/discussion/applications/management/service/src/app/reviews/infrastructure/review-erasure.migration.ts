import { TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm';
import {
  MemberReviews1791676827000,
  reviewErasureChecks,
  reviewErasureIndexes,
} from './member-reviews.migration';

type Row = Record<string, unknown>;

export class ReviewErasure1791840008000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const applied: unknown[] = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT id FROM ${runner.connection.driver.escape(
            history
          )} WHERE name=?`,
          [this.constructor.name]
        )
      : [];
    for (const name of [
      'member_reviews',
      'review_versions',
      'review_helpful',
      'review_reports',
      'review_commands',
      'review_events',
      'review_applications',
      'identity_erasure_requests',
    ]) {
      const table = await runner.getTable(name);
      const triggers: unknown[] = await runner.query(
        'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=?',
        [name]
      );
      if (!table || table.foreignKeys.length || triggers.length)
        throw new Error(
          `Review erasure requires unmodified authority: ${name}`
        );
    }
    for (const [name, type] of [
      ['ownerId', 'varchar(128)'],
      ['contentRevision', 'bigint unsigned'],
    ] as const) {
      const [column]: {
        type: string;
        nullable: string;
        collation: string | null;
        engine: string;
      }[] = await runner.query(
        "SELECT c.COLUMN_TYPE AS type,c.IS_NULLABLE AS nullable,c.COLLATION_NAME AS collation,t.ENGINE AS engine FROM information_schema.COLUMNS c JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME WHERE c.TABLE_SCHEMA=DATABASE() AND c.TABLE_NAME='member_reviews' AND c.COLUMN_NAME=?",
        [name]
      );
      if (
        !column ||
        column.type !== type ||
        column.engine !== 'InnoDB' ||
        column.collation !== (name === 'ownerId' ? 'utf8mb4_bin' : null)
      )
        throw new Error(`Incompatible review erasure column ${name}`);
      if (column.nullable !== 'YES') {
        if (applied.length)
          throw new Error(`Applied review anonymity is missing: ${name}`);
        await runner.query(
          `ALTER TABLE member_reviews MODIFY ${name} ${type}${
            name === 'ownerId'
              ? ' CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'
              : ''
          } NULL`
        );
      }
    }
    for (const [table, name] of [
      ['member_reviews', 'erasedAt'],
      ['review_reports', 'resolutionRevision'],
    ] as const) {
      if (!(await runner.getTable(table))?.findColumnByName(name)) {
        if (applied.length)
          throw new Error(`Applied review erasure column is missing: ${name}`);
        await runner.query(
          `ALTER TABLE ${table} ADD ${name} bigint unsigned NULL`
        );
      }
    }
    if (!(await runner.hasTable('review_erasure_targets'))) {
      if (applied.length)
        throw new Error('Applied review erasure targets are missing');
      await runner.query(`CREATE TABLE review_erasure_targets (
        identityId varchar(128) NOT NULL, erasureRevision bigint unsigned NOT NULL,
        reviewId varchar(36) NOT NULL, cutoffRevision bigint unsigned NOT NULL,
        PRIMARY KEY (identityId,reviewId), UNIQUE KEY uq_review_erasure (reviewId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    }
    for (const [table, name, columns] of reviewErasureIndexes) {
      if (
        !(await runner.getTable(table))?.indices.some(
          (index) => index.name === name
        )
      ) {
        if (applied.length)
          throw new Error(`Applied review erasure index is missing: ${name}`);
        await runner.createIndex(
          table,
          new TableIndex({ name, columnNames: [...columns] })
        );
      }
      const invalidIndex: unknown[] = await runner.query(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? AND (IS_VISIBLE<>'YES' OR INDEX_TYPE<>'BTREE') LIMIT 1",
        [table, name]
      );
      if (invalidIndex.length)
        throw new Error(`Incompatible review erasure index: ${name}`);
    }
    // Event order identifies the first resolving moderation even when wall-clock times collide.
    let after = '';
    for (;;) {
      const reports: Row[] = await runner.query(
        "SELECT * FROM review_reports WHERE id>? AND resolution<>'open' AND resolutionRevision IS NULL ORDER BY id LIMIT 128",
        [after]
      );
      if (applied.length && reports.length)
        throw new Error('Applied review resolution provenance is missing');
      for (const report of reports) {
        const reported: Row[] = await runner.query(
          "SELECT revision,createdAt,reason FROM review_events WHERE reviewId=? AND actorId=? AND contentRevision=? AND type='report' ORDER BY revision LIMIT 2",
          [report.reviewId, report.actorId, report.contentRevision]
        );
        const [event]: Row[] =
          reported.length === 1
            ? await runner.query(
                "SELECT revision,createdAt,reason FROM review_events WHERE reviewId=? AND type='moderate' AND revision>? ORDER BY revision LIMIT 1",
                [report.reviewId, reported[0].revision]
              )
            : [];
        if (
          !event ||
          String(reported[0].createdAt) !== String(report.createdAt) ||
          reported[0].reason !== report.reason ||
          String(event.createdAt) !== String(report.resolvedAt) ||
          event.reason !== report.resolutionReason
        )
          throw new Error(
            'Review resolution provenance requires authoritative repair'
          );
        await runner.query(
          'UPDATE review_reports SET resolutionRevision=? WHERE id=? AND resolutionRevision IS NULL',
          [event.revision, report.id]
        );
        if (typeof report.id !== 'string')
          throw new Error('Invalid review report ID');
        after = report.id;
      }
      if (reports.length < 128) break;
    }
    for (const [table, name] of [
      ['member_reviews', 'ck_review_erased'],
      ['review_reports', 'ck_review_resolution_revision'],
    ] as const) {
      const checks: unknown[] = await runner.query(
        'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=?',
        [table, name]
      );
      if (!checks.length) {
        if (applied.length)
          throw new Error(
            `Applied review erasure constraint is missing: ${name}`
          );
        await runner.query(
          `ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${reviewErasureChecks[name]})`
        );
      }
    }
    await new MemberReviews1791676827000().up(runner, true);
    const invalid: unknown[] =
      await runner.query(`SELECT e.reviewId FROM review_erasure_targets e
      LEFT JOIN member_reviews r ON r.id=e.reviewId LEFT JOIN identity_erasure_requests q ON q.identityId=e.identityId
      LEFT JOIN identity_erasure_barriers b ON b.identityId=e.identityId
      WHERE r.id IS NULL OR r.ownerId IS NOT NULL OR e.cutoffRevision<1 OR e.cutoffRevision>=r.revision
      OR q.identityId IS NULL OR q.revision<>e.erasureRevision OR q.completedAt IS NOT NULL
      OR b.erasureRevision IS NULL OR b.erasureRevision<>e.erasureRevision LIMIT 1`);
    if (invalid.length)
      throw new Error('Invalid review erasure target authority');
  }

  async down(): Promise<void> {
    throw new Error(
      'Review erasure requires a reviewed data-preserving rollback'
    );
  }
}
