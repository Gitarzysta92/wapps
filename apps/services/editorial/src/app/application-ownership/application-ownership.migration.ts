import { assertEditorialMigrationIndexes } from '../infrastructure/editorial-schema-compatibility';
import {
  assertEditorialReviewActor,
  editorialAuditErasureApplied,
} from '../account-erasure/editorial-audit-erasure-schema';
import {
  Table,
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';
import {
  OWNERSHIP_PROOF_FRESHNESS,
  ownershipId,
  ownershipRevision,
  ownershipTime,
  parseOwnershipChangeInput,
  parseOwnershipReceipt,
} from '@domains/catalog/ownership';
import {
  ownershipClaimFromRow,
  type OwnershipRow,
} from './mysql-application-ownership';

export class ApplicationOwnership1791676812000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const anonymous = await editorialAuditErasureApplied(runner);
    const string = (
      name: string,
      length: string,
      isPrimary = false,
      isNullable = false
    ) => ({ name, type: 'varchar', length, isPrimary, isNullable });
    const integer = (name: string, isNullable = false, isPrimary = false) => ({
      name,
      type: 'bigint',
      unsigned: true,
      isNullable,
      isPrimary,
    });
    const scope = [
      string('tenantId', '128', true),
      string('actorIdentityId', '128', true),
      string('commandKey', '128', true),
    ];
    const tables = [
      new Table({
        name: 'application_ownership_workspaces',
        columns: [
          string('tenantId', '128', true),
          string('claimantIdentityId', '128', true),
        ],
      }),
      new Table({
        name: 'application_ownership_claims',
        columns: [
          string('id', '36', true),
          string('tenantId', '128'),
          string('claimantIdentityId', '128'),
          string('applicationId', '36'),
          integer('revision'),
          integer('applicationRevision'),
          string('applicationName', '100'),
          string('applicationSlug', '80'),
          string('website', '2048'),
          string('hostname', '235'),
          string('evidenceUrl', '2048'),
          { name: 'notes', type: 'text' },
          string('challengeName', '253'),
          string('challengeValue', '80'),
          string('status', '20'),
          integer('createdAt'),
          integer('updatedAt'),
          integer('expiresAt'),
          integer('verifiedAt', true),
          integer('reviewedAt', true),
          string('reviewerIdentityId', '128', false, true),
          { name: 'reason', type: 'text' },
          { name: 'checkCount', type: 'int', unsigned: true },
          integer('lastCheckAt', true),
        ],
        indices: [
          {
            name: 'idx_ownership_claimant',
            columnNames: ['tenantId', 'claimantIdentityId', 'createdAt'],
          },
          {
            name: 'idx_ownership_review',
            columnNames: ['tenantId', 'status', 'createdAt'],
          },
        ],
      }),
      new Table({
        name: 'application_ownership_grants',
        columns: [
          string('applicationId', '36', true),
          string('tenantId', '128'),
          string('claimantIdentityId', '128'),
          string('claimId', '36'),
          integer('grantedAt'),
          integer('revokedAt', true),
        ],
      }),
      new Table({
        name: 'application_ownership_commands',
        columns: [
          ...scope,
          string('claimId', '36'),
          { name: 'fingerprint', type: 'char', length: '64' },
          { name: 'receipt', type: 'json' },
          integer('createdAt'),
        ],
      }),
      new Table({
        name: 'application_ownership_checks',
        columns: [
          ...scope,
          string('claimId', '36'),
          { name: 'fingerprint', type: 'char', length: '64' },
          { name: 'leaseToken', type: 'char', length: '64' },
          integer('leaseUntil'),
          { name: 'executions', type: 'int', unsigned: true },
          integer('createdAt'),
        ],
      }),
      new Table({
        name: 'application_ownership_decisions',
        columns: [
          string('claimId', '36', true),
          integer('revision', false, true),
          string('actorIdentityId', '128', false, anonymous),
          string('action', '16'),
          { name: 'reason', type: 'text' },
          integer('verifiedAt', true),
          integer('applicationRevision', true),
          integer('createdAt'),
        ],
      }),
    ];
    if (anonymous) {
      tables
        .find((table) => table.name === 'application_ownership_claims')
        ?.addColumn(
          new TableColumn({
            name: 'reviewerErasedAt',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          })
        );
      tables
        .find((table) => table.name === 'application_ownership_decisions')
        ?.addColumn(
          new TableColumn({
            name: 'actorErasedAt',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          })
        );
    }
    for (const table of tables) {
      table.engine = 'InnoDB';
      for (const column of table.columns)
        if (['varchar', 'char', 'text'].includes(column.type)) {
          column.charset = 'utf8mb4';
          column.collation = 'utf8mb4_bin';
        }
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
      const actual = await runner.getTable(table.name);
      await assertEditorialMigrationIndexes(runner, table);
      const [storage] = await runner.query(
        'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table.name]
      );
      const physical: { name: string; collation: string | null }[] =
        await runner.query(
          'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [table.name]
        );
      const keys: { name: string }[] = await runner.query(
        "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
        [table.name]
      );
      if (
        storage?.engine !== 'InnoDB' ||
        !actual ||
        actual.columns.length !== table.columns.length ||
        JSON.stringify(keys.map((row) => row.name)) !==
          JSON.stringify(table.primaryColumns.map((column) => column.name)) ||
        table.columns.some((expected) => {
          const column = actual.columns.find(
            (item) => item.name === expected.name
          );
          return (
            !column ||
            column.type !== expected.type ||
            column.length !== expected.length ||
            column.isNullable !== expected.isNullable ||
            column.isPrimary !== expected.isPrimary ||
            column.unsigned !== expected.unsigned ||
            (expected.collation &&
              physical.find((item) => item.name === expected.name)
                ?.collation !== expected.collation)
          );
        })
      )
        throw new Error(
          `Incompatible application ownership schema: ${table.name}`
        );
    }
    let cursor: string | null = null;
    for (;;) {
      const rows: OwnershipRow[] = await runner.query(
        'SELECT * FROM application_ownership_claims' +
          (cursor ? ' WHERE id > ?' : '') +
          ' ORDER BY id LIMIT 200',
        cursor ? [cursor] : []
      );
      for (const row of rows) {
        const claim = ownershipClaimFromRow(row);
        if (
          !row.tenantId.trim() ||
          row.tenantId.trim() !== row.tenantId ||
          claim.claimantIdentityId !== row.claimantIdentityId ||
          !Number.isInteger(row.checkCount) ||
          row.checkCount < 0 ||
          row.checkCount > 10 ||
          (row.checkCount === 0) !== (row.lastCheckAt === null) ||
          (row.lastCheckAt !== null &&
            ownershipTime(Number(row.lastCheckAt)) < claim.createdAt) ||
          (['approved', 'rejected', 'revoked'].includes(claim.status)
            ? row.reviewerIdentityId === null
              ? !anonymous
              : !row.reviewerIdentityId.trim()
            : row.reviewerIdentityId !== null)
        )
          throw new Error('Invalid stored ownership metadata');
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].id;
    }
    for (const table of [
      'application_ownership_commands',
      'application_ownership_checks',
    ]) {
      let key: [string, string, string] | null = null;
      for (;;) {
        const rows: {
          tenantId: string;
          actorIdentityId: string;
          commandKey: string;
          claimId: string;
          fingerprint: string;
          receipt: unknown;
          createdAt: string | number;
          leaseToken: string;
          leaseUntil: string | number;
          executions: number;
        }[] = await runner.query(
          `SELECT * FROM ${table}` +
            (key
              ? ' WHERE (tenantId, actorIdentityId, commandKey) > (?, ?, ?)'
              : '') +
            ' ORDER BY tenantId, actorIdentityId, commandKey LIMIT 200',
          key ?? []
        );
        for (const row of rows) {
          ownershipId(row.claimId);
          const at = ownershipTime(Number(row.createdAt));
          if (
            !row.tenantId.trim() ||
            !row.actorIdentityId.trim() ||
            !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey) ||
            !/^[0-9a-f]{64}$/.test(row.fingerprint)
          )
            throw new Error('Invalid stored ownership command');
          if (table === 'application_ownership_commands') {
            const receipt = parseOwnershipReceipt(
              typeof row.receipt === 'string'
                ? JSON.parse(row.receipt)
                : row.receipt
            );
            if (receipt.id !== row.claimId)
              throw new Error('Ownership receipt targets another claim');
          } else if (
            !/^[0-9a-f]{64}$/.test(row.leaseToken) ||
            ownershipTime(Number(row.leaseUntil)) < at ||
            !Number.isInteger(row.executions) ||
            row.executions < 1 ||
            row.executions > 3
          )
            throw new Error('Invalid ownership verification lease');
        }
        if (rows.length < 200) break;
        const last = rows[rows.length - 1];
        key = [last.tenantId, last.actorIdentityId, last.commandKey];
      }
    }
    let decisionCursor: [string, number] | null = null;
    for (;;) {
      const rows: {
        claimId: string;
        revision: string | number;
        actorIdentityId: string | null;
        actorErasedAt?: unknown;
        action: string;
        reason: string;
        verifiedAt: string | number | null;
        applicationRevision: string | number | null;
        createdAt: string | number;
      }[] = await runner.query(
        'SELECT * FROM application_ownership_decisions' +
          (decisionCursor ? ' WHERE (claimId, revision) > (?, ?)' : '') +
          ' ORDER BY claimId, revision LIMIT 200',
        decisionCursor ?? []
      );
      for (const row of rows) {
        ownershipId(row.claimId);
        const at = ownershipTime(Number(row.createdAt));
        const revision = ownershipRevision(Number(row.revision));
        const action = row.action;
        if (
          action !== 'approve' &&
          action !== 'reject' &&
          action !== 'revoke' &&
          action !== 'release'
        )
          throw new Error('Invalid ownership decision');
        parseOwnershipChangeInput(action, {
          expectedRevision: revision - 1,
          reason: row.reason,
        });
        if (
          (row.actorIdentityId !== null && !row.actorIdentityId.trim()) ||
          (row.verifiedAt !== null &&
            ownershipTime(Number(row.verifiedAt)) > at) ||
          (action !== 'reject' &&
            (row.applicationRevision === null || row.verifiedAt === null)) ||
          (action === 'reject' && row.applicationRevision !== null) ||
          (row.applicationRevision !== null &&
            ownershipRevision(Number(row.applicationRevision)) < 2) ||
          (action === 'approve' &&
            at - Number(row.verifiedAt) > OWNERSHIP_PROOF_FRESHNESS)
        )
          throw new Error('Invalid ownership decision proof');
        const [claim]: OwnershipRow[] = await runner.query(
          'SELECT * FROM application_ownership_claims WHERE id=?',
          [row.claimId]
        );
        if (!claim) throw new Error('Missing ownership decision claim');
        assertEditorialReviewActor(
          {
            actor: row.actorIdentityId,
            erasedAt: row.actorErasedAt,
            owner: claim.claimantIdentityId,
            reviewedAt: at,
            decided: true,
            self: action === 'release',
          },
          anonymous
        );
      }
      if (rows.length < 200) break;
      const last = rows[rows.length - 1];
      decisionCursor = [last.claimId, Number(last.revision)];
    }
    const anonymousMatch = anonymous
      ? ' OR NOT (d.actorErasedAt <=> c.reviewerErasedAt)'
      : '';
    const checks = [
      `SELECT c.id FROM application_ownership_claims c
       LEFT JOIN application_ownership_workspaces w ON w.tenantId = c.tenantId AND w.claimantIdentityId = c.claimantIdentityId
       LEFT JOIN editorial_resource_states e ON e.resourceKind = 'app' AND e.resourceId = c.applicationId
       WHERE w.claimantIdentityId IS NULL OR e.resourceId IS NULL OR e.tenantId <> c.tenantId OR c.applicationRevision > e.revision LIMIT 1`,
      "SELECT applicationId FROM application_ownership_claims WHERE status IN ('awaiting-proof','awaiting-review','approved') GROUP BY tenantId, claimantIdentityId, applicationId HAVING COUNT(*) > 1 LIMIT 1",
      "SELECT tenantId FROM application_ownership_claims WHERE status IN ('awaiting-proof','awaiting-review') GROUP BY tenantId, claimantIdentityId HAVING COUNT(*) > 20 LIMIT 1",
      `SELECT g.applicationId FROM application_ownership_grants g
       LEFT JOIN application_ownership_claims c ON c.id = g.claimId
       LEFT JOIN editorial_resource_states e ON e.resourceKind = 'app' AND e.resourceId = g.applicationId
       LEFT JOIN application_ownership_decisions d ON d.claimId = c.id AND d.action = 'approve' AND d.createdAt = g.grantedAt
       WHERE c.id IS NULL OR e.resourceId IS NULL OR d.claimId IS NULL OR g.tenantId <> c.tenantId OR g.claimantIdentityId <> c.claimantIdentityId
       OR g.applicationId <> c.applicationId OR g.tenantId <> e.tenantId
       OR (g.revokedAt IS NULL AND (c.status <> 'approved' OR e.ownerIdentityId <> c.claimantIdentityId))
       OR (g.revokedAt IS NOT NULL AND (c.status <> 'revoked' OR g.revokedAt < g.grantedAt OR g.revokedAt <> c.reviewedAt)) LIMIT 1`,
      `SELECT c.id FROM application_ownership_claims c LEFT JOIN application_ownership_decisions d ON d.claimId = c.id AND d.revision = c.revision
       WHERE (c.status IN ('approved','rejected','revoked') AND (d.claimId IS NULL OR d.createdAt <> c.reviewedAt OR NOT (d.actorIdentityId <=> c.reviewerIdentityId) OR d.reason <> c.reason${anonymousMatch}))
       OR (c.status = 'approved' AND d.action <> 'approve') OR (c.status = 'rejected' AND d.action <> 'reject')
       OR (c.status = 'revoked' AND d.action NOT IN ('release','revoke')) LIMIT 1`,
      `SELECT c.id FROM application_ownership_claims c LEFT JOIN application_ownership_grants g ON g.claimId = c.id AND g.applicationId = c.applicationId AND g.revokedAt IS NULL
       WHERE c.status = 'approved' AND g.claimId IS NULL LIMIT 1`,
      `SELECT d.claimId FROM application_ownership_decisions d LEFT JOIN application_ownership_claims c ON c.id = d.claimId
       WHERE c.id IS NULL OR d.revision > c.revision OR d.createdAt < c.createdAt OR d.createdAt > c.updatedAt
       OR (d.action = 'release' AND NOT (d.actorIdentityId <=> c.claimantIdentityId))
       OR (d.action <> 'release' AND d.actorIdentityId = c.claimantIdentityId)
       OR (d.action = 'approve' AND d.createdAt >= c.expiresAt) LIMIT 1`,
      `SELECT r.claimId FROM application_ownership_commands r LEFT JOIN application_ownership_claims c ON c.id = r.claimId AND c.tenantId = r.tenantId
       LEFT JOIN editorial_resource_states e ON e.resourceKind = 'app' AND e.resourceId = c.applicationId
       WHERE c.id IS NULL OR JSON_EXTRACT(r.receipt, '$.revision') > c.revision OR r.createdAt < c.createdAt OR r.createdAt > c.updatedAt
       OR (JSON_UNQUOTE(JSON_EXTRACT(r.receipt, '$.action')) IN ('create','verify','cancel','release') AND r.actorIdentityId <> c.claimantIdentityId)
       OR (JSON_UNQUOTE(JSON_EXTRACT(r.receipt, '$.action')) IN ('approve','reject','revoke') AND r.actorIdentityId = c.claimantIdentityId)
       OR (JSON_TYPE(JSON_EXTRACT(r.receipt, '$.applicationRevision')) <> 'NULL' AND JSON_EXTRACT(r.receipt, '$.applicationRevision') > e.revision) LIMIT 1`,
      `SELECT a.claimId FROM application_ownership_checks a LEFT JOIN application_ownership_claims c ON c.id = a.claimId AND c.tenantId = a.tenantId AND c.claimantIdentityId = a.actorIdentityId
       LEFT JOIN application_ownership_commands r ON r.tenantId = a.tenantId AND r.actorIdentityId = a.actorIdentityId AND r.commandKey = a.commandKey
       WHERE c.id IS NULL OR a.createdAt < c.createdAt OR (r.commandKey IS NOT NULL AND (r.fingerprint <> a.fingerprint OR r.claimId <> a.claimId OR JSON_UNQUOTE(JSON_EXTRACT(r.receipt, '$.action')) <> 'verify')) LIMIT 1`,
    ];
    for (const query of checks)
      if ((await runner.query(query)).length)
        throw new Error(
          'Invalid ownership history or authority relationships; repair explicitly'
        );
  }
  async down(): Promise<void> {
    throw new Error(
      'Ownership grants and decision history are authoritative; use a reviewed data-preserving migration'
    );
  }
}
