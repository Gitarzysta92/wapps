import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import { editorialSqlInteger } from '../infrastructure/mysql-editorial-snapshot';
import { editorialWorkspaceFamilies } from './editorial-workspace-erasure.tables';
import {
  ownershipClaimFromRow,
  type OwnershipRow,
} from '../application-ownership/mysql-application-ownership';
import {
  assertEditorialReviewActor,
  editorialAuditErasureApplied,
  recordApplicationOwnershipHistory,
} from './editorial-audit-erasure-schema';

type Row = Record<string, unknown>;
const stamps = [
  ...editorialWorkspaceFamilies.map(
    (family) => [family.submissions, 'reviewerErasedAt'] as const
  ),
  ['application_ownership_claims', 'reviewerErasedAt'],
  ['application_ownership_decisions', 'actorErasedAt'],
] as const;
const indexes = [
  ...editorialWorkspaceFamilies.map(
    (family) =>
      [
        family.submissions,
        'idx_erasure_reviewer',
        ['reviewerIdentityId', family.parent, 'submittedRevision'],
      ] as const
  ),
  [
    'application_ownership_claims',
    'idx_erasure_claimant',
    ['claimantIdentityId', 'id'],
  ],
  [
    'application_ownership_grants',
    'idx_erasure_claimant',
    ['claimantIdentityId', 'applicationId'],
  ],
  [
    'application_ownership_claims',
    'idx_erasure_reviewer',
    ['reviewerIdentityId', 'id'],
  ],
  [
    'application_ownership_claims',
    'idx_erasure_application',
    ['applicationId', 'tenantId', 'id'],
  ],
  [
    'application_ownership_grants',
    'idx_erasure_claim',
    ['claimId', 'applicationId'],
  ],
  [
    'application_ownership_commands',
    'idx_erasure_claim',
    ['claimId', 'tenantId', 'actorIdentityId', 'commandKey'],
  ],
  [
    'application_ownership_commands',
    'idx_erasure_actor',
    ['actorIdentityId', 'tenantId', 'commandKey'],
  ],
  [
    'application_ownership_checks',
    'idx_erasure_claim',
    ['claimId', 'tenantId', 'actorIdentityId', 'commandKey'],
  ],
  [
    'application_ownership_checks',
    'idx_erasure_actor',
    ['actorIdentityId', 'tenantId', 'commandKey'],
  ],
  [
    'application_ownership_decisions',
    'idx_erasure_actor',
    ['actorIdentityId', 'claimId', 'revision'],
  ],
  [
    'application_ownership_workspaces',
    'idx_erasure_claimant',
    ['claimantIdentityId', 'tenantId'],
  ],
  ['application_editing_targets', 'idx_erasure_claim', ['claimId', 'draftId']],
  ['release_drafts', 'idx_erasure_claim', ['claimId', 'id']],
  [
    'editorial_commands',
    'idx_erasure_actor',
    ['actorIdentityId', 'tenantId', 'commandKey'],
  ],
  ['editorial_outbox', 'idx_erasure_actor', ['actorIdentityId', 'id']],
] as const;

/** Preserve independence and permanent bound-authoring history while erasing private identity attribution. */
export class EditorialAuditErasure1791840013000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const applied = await editorialAuditErasureApplied(runner);
    const missing: (typeof stamps)[number][] = [];
    let changeActor = false;
    for (const entry of stamps) {
      const [table, stamp] = entry;
      const columns = await this.columns(runner, table);
      const actor = columns.find(
        (row) =>
          row.name ===
          (stamp === 'actorErasedAt' ? 'actorIdentityId' : 'reviewerIdentityId')
      );
      if (
        !actor ||
        actor.engine !== 'InnoDB' ||
        actor.type !== 'varchar' ||
        Number(actor.length) !== 128 ||
        actor.collation !== 'utf8mb4_bin' ||
        actor.defaultValue !== null ||
        actor.extra !== '' ||
        actor.expression !== '' ||
        (actor.nullable !== 'YES' && (applied || stamp !== 'actorErasedAt'))
      )
        throw new Error('Incompatible Editorial audit identity schema');
      const column = columns.find((row) => row.name === stamp);
      if (!column) {
        if (applied)
          throw new Error('Applied Editorial audit stamp is missing');
        missing.push(entry);
      } else if (
        column.sqlType !== 'bigint unsigned' ||
        column.nullable !== 'YES' ||
        column.defaultValue !== null ||
        column.extra !== '' ||
        column.expression !== ''
      )
        throw new Error('Incompatible Editorial audit stamp');
      if (stamp === 'actorErasedAt' && actor.nullable === 'NO')
        changeActor = true;
    }
    const missingIndexes: (typeof indexes)[number][] = [];
    for (const index of indexes) {
      await this.indexAuthority(runner, index[0], index[2], applied);
      if (!(await this.index(runner, index[0], index[1], index[2], !applied)))
        missingIndexes.push(index);
    }
    const history = await runner.hasTable('application_ownership_history');
    if (history) await this.historySchema(runner);
    else if (applied) throw new Error('Applied ownership history is missing');
    await this.reviews(runner, applied);
    await this.grants(runner, history, applied);
    for (const [table, stamp] of missing)
      await runner.query(
        `ALTER TABLE ${table} ADD COLUMN ${stamp} bigint UNSIGNED NULL`
      );
    if (changeActor)
      await runner.query(
        'ALTER TABLE application_ownership_decisions MODIFY actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL'
      );
    if (!history)
      await runner.query(
        'CREATE TABLE application_ownership_history (applicationId varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,tenantId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,establishedAt bigint UNSIGNED NOT NULL,PRIMARY KEY(applicationId)) ENGINE=InnoDB'
      );
    for (const [table, name, columns] of missingIndexes)
      await runner.query(
        `CREATE INDEX ${name} ON ${table} (${columns.join(',')})`
      );
    let cursor = '';
    for (;;) {
      const rows: Row[] = await runner.query(
        'SELECT applicationId,tenantId,grantedAt FROM application_ownership_grants WHERE applicationId>? ORDER BY applicationId LIMIT 128',
        [cursor]
      );
      await runner.connection.transaction(async (manager) => {
        for (const row of rows) {
          if (
            !isEditorialResourceId(row.applicationId) ||
            !isEditorialScope(row.tenantId)
          )
            throw new Error('Invalid ownership history authority');
          const [approval]: Row[] = await manager.query(
            "SELECT MIN(d.createdAt) AS establishedAt FROM application_ownership_claims c JOIN application_ownership_decisions d ON d.claimId=c.id AND d.action='approve' WHERE c.applicationId=? AND c.tenantId=?",
            [row.applicationId, row.tenantId]
          );
          await recordApplicationOwnershipHistory(
            manager,
            row.applicationId,
            row.tenantId,
            editorialSqlInteger(approval?.establishedAt, 1)
          );
        }
      });
      if (rows.length < 128) break;
      cursor = String(rows[rows.length - 1].applicationId);
    }
    await this.historySchema(runner);
    await this.grants(runner, true, true);
    for (const [table, name, columns] of indexes)
      await this.index(runner, table, name, columns, false);
  }

  private async reviews(runner: QueryRunner, anonymous: boolean) {
    for (const family of editorialWorkspaceFamilies) {
      let after: [string, number] = ['', 0];
      for (;;) {
        const rows: Row[] = await runner.query(
          `SELECT s.*,d.ownerIdentityId AS author FROM ${family.submissions} s LEFT JOIN ${family.drafts} d ON d.id=s.${family.parent} WHERE (s.${family.parent},s.submittedRevision)>(?,?) ORDER BY s.${family.parent},s.submittedRevision LIMIT 128`,
          after
        );
        for (const row of rows) {
          if (!isEditorialScope(row.author))
            throw new Error('Missing Editorial review author');
          assertEditorialReviewActor(
            {
              actor: row.reviewerIdentityId,
              owner: row.author,
              reviewedAt:
                row.reviewedAt === null
                  ? null
                  : editorialSqlInteger(row.reviewedAt, 1),
              decided: row.status === 'approved' || row.status === 'rejected',
              erasedAt: row.reviewerErasedAt,
            },
            anonymous
          );
          after = [
            String(row[family.parent]),
            editorialSqlInteger(row.submittedRevision, 1),
          ];
        }
        if (rows.length < 128) break;
      }
    }
    let after: [string, number] = ['', 0];
    for (;;) {
      const rows: Row[] = await runner.query(
        'SELECT d.*,c.claimantIdentityId AS claimant FROM application_ownership_decisions d LEFT JOIN application_ownership_claims c ON c.id=d.claimId WHERE (d.claimId,d.revision)>(?,?) ORDER BY d.claimId,d.revision LIMIT 128',
        after
      );
      for (const row of rows) {
        if (!isEditorialScope(row.claimant))
          throw new Error('Missing Editorial decision claimant');
        assertEditorialReviewActor(
          {
            actor: row.actorIdentityId,
            owner: row.claimant,
            reviewedAt: editorialSqlInteger(row.createdAt, 1),
            decided: true,
            self: row.action === 'release',
            erasedAt: row.actorErasedAt,
          },
          anonymous
        );
        after = [String(row.claimId), editorialSqlInteger(row.revision, 1)];
      }
      if (rows.length < 128) break;
    }
    let cursor = '';
    for (;;) {
      const claims: OwnershipRow[] = await runner.query(
        'SELECT * FROM application_ownership_claims WHERE id>? ORDER BY id LIMIT 128',
        [cursor]
      );
      for (const claim of claims) {
        ownershipClaimFromRow(claim);
        if (!isEditorialScope(claim.claimantIdentityId))
          throw new Error('Invalid ownership claimant');
        const decisions: Row[] = await runner.query(
          'SELECT * FROM application_ownership_decisions WHERE claimId=? ORDER BY revision LIMIT 3',
          [claim.id]
        );
        const latest = decisions[decisions.length - 1];
        const expected =
          claim.status === 'revoked'
            ? 2
            : ['approved', 'rejected'].includes(String(claim.status))
            ? 1
            : 0;
        if (
          decisions.length !== expected ||
          (expected === 2 &&
            (decisions[0].action !== 'approve' ||
              !['revoke', 'release'].includes(String(latest.action)) ||
              Number(latest.revision) !== Number(decisions[0].revision) + 1)) ||
          (expected === 1 &&
            latest.action !==
              (claim.status === 'approved' ? 'approve' : 'reject')) ||
          (latest &&
            (Number(latest.revision) !== Number(claim.revision) ||
              Number(latest.createdAt) !== Number(claim.reviewedAt) ||
              latest.actorIdentityId !== claim.reviewerIdentityId ||
              String(latest.actorErasedAt ?? '') !==
                String(claim.reviewerErasedAt ?? '') ||
              latest.reason !== claim.reason))
        )
          throw new Error('Ownership decision history differs from its claim');
        assertEditorialReviewActor(
          {
            actor: claim.reviewerIdentityId,
            owner: claim.claimantIdentityId,
            reviewedAt:
              claim.reviewedAt === null
                ? null
                : editorialSqlInteger(claim.reviewedAt, 1),
            decided: expected !== 0,
            self: latest?.action === 'release',
            erasedAt: claim.reviewerErasedAt,
          },
          anonymous
        );
        cursor = String(claim.id);
      }
      if (claims.length < 128) break;
    }
  }

  private async grants(
    runner: QueryRunner,
    history: boolean,
    complete: boolean
  ) {
    const invalid = await runner.query(
      `SELECT g.applicationId FROM application_ownership_grants g LEFT JOIN application_ownership_claims c ON c.id=g.claimId LEFT JOIN editorial_resource_states e ON e.resourceKind='app' AND e.resourceId=g.applicationId WHERE c.id IS NULL OR e.resourceId IS NULL OR g.tenantId<>c.tenantId OR g.tenantId<>e.tenantId OR g.applicationId<>c.applicationId OR g.claimantIdentityId<>c.claimantIdentityId OR g.grantedAt<1 OR (g.revokedAt IS NULL AND (c.status<>'approved' OR NOT(e.ownerIdentityId<=>g.claimantIdentityId))) OR (g.revokedAt IS NOT NULL AND (c.status<>'revoked' OR g.revokedAt<g.grantedAt)) LIMIT 1`
    );
    if (invalid.length) throw new Error('Invalid ownership history source');
    if (
      (
        await runner.query(
          "SELECT c.id FROM application_ownership_claims c LEFT JOIN editorial_resource_states e ON e.resourceKind='app' AND e.resourceId=c.applicationId WHERE e.resourceId IS NULL OR e.tenantId<>c.tenantId OR c.applicationRevision>e.revision LIMIT 1"
        )
      ).length
    )
      throw new Error('Invalid ownership claim authority');
    if (history) {
      if (
        (
          await runner.query(
            "SELECT h.applicationId FROM application_ownership_history h LEFT JOIN editorial_resource_states e ON e.resourceKind='app' AND e.resourceId=h.applicationId WHERE e.resourceId IS NULL OR h.tenantId<>e.tenantId OR h.establishedAt<1 OR h.establishedAt>9007199254740991 LIMIT 1"
          )
        ).length ||
        (
          await runner.query(
            "SELECT c.applicationId FROM application_ownership_claims c JOIN application_ownership_decisions d ON d.claimId=c.id AND d.action='approve' JOIN application_ownership_history h ON h.applicationId=c.applicationId WHERE h.tenantId<>c.tenantId OR h.establishedAt>d.createdAt LIMIT 1"
          )
        ).length
      )
        throw new Error('Invalid permanent ownership history');
      if (complete)
        if (
          (
            await runner.query(
              "SELECT c.applicationId FROM application_ownership_claims c JOIN application_ownership_decisions d ON d.claimId=c.id AND d.action='approve' LEFT JOIN application_ownership_history h ON h.applicationId=c.applicationId WHERE h.applicationId IS NULL LIMIT 1"
            )
          ).length
        )
          throw new Error('Applied ownership history entry is missing');
    }
  }

  private async historySchema(runner: QueryRunner) {
    const rows = await this.columns(runner, 'application_ownership_history');
    if (
      rows.length !== 3 ||
      rows.some(
        (row) =>
          row.engine !== 'InnoDB' ||
          row.nullable !== 'NO' ||
          row.defaultValue !== null ||
          row.extra !== '' ||
          row.expression !== '' ||
          (row.name === 'establishedAt'
            ? row.sqlType !== 'bigint unsigned'
            : !['applicationId', 'tenantId'].includes(String(row.name)) ||
              row.type !== 'varchar' ||
              row.collation !== 'utf8mb4_bin' ||
              Number(row.length) !== (row.name === 'applicationId' ? 36 : 128))
      )
    )
      throw new Error('Incompatible permanent ownership history schema');
    if (
      (
        await runner.query(
          "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='application_ownership_history' LIMIT 1"
        )
      ).length ||
      (
        await runner.query(
          "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_ownership_history' AND CONSTRAINT_TYPE<>'PRIMARY KEY' LIMIT 1"
        )
      ).length
    )
      throw new Error('Unexpected permanent ownership history constraint');
    await this.index(
      runner,
      'application_ownership_history',
      'PRIMARY',
      ['applicationId'],
      false
    );
  }

  private columns(runner: QueryRunner, table: string): Promise<Row[]> {
    return runner.query(
      'SELECT t.ENGINE AS engine,c.COLUMN_NAME AS name,c.DATA_TYPE AS type,c.COLUMN_TYPE AS sqlType,c.IS_NULLABLE AS nullable,c.COLLATION_NAME AS collation,c.CHARACTER_MAXIMUM_LENGTH AS length,c.COLUMN_DEFAULT AS defaultValue,c.EXTRA AS extra,c.GENERATION_EXPRESSION AS expression FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=?',
      [table]
    );
  }

  private async indexAuthority(
    runner: QueryRunner,
    table: string,
    names: readonly string[],
    applied: boolean
  ) {
    const columns = await this.columns(runner, table);
    for (const name of names) {
      const column = columns.find((row) => row.name === name);
      const actor =
        name === 'reviewerIdentityId' ||
        (name === 'actorIdentityId' &&
          ['editorial_outbox', 'application_ownership_decisions'].includes(
            table
          ));
      const number =
        ['revision', 'submittedRevision'].includes(name) ||
        (table === 'editorial_outbox' && name === 'id');
      if (
        !column ||
        column.engine !== 'InnoDB' ||
        column.defaultValue !== null ||
        column.expression !== '' ||
        column.extra !==
          (table === 'editorial_outbox' && name === 'id'
            ? 'auto_increment'
            : '') ||
        (column.nullable !== (actor ? 'YES' : 'NO') &&
          !(
            table === 'application_ownership_decisions' &&
            actor &&
            !applied
          )) ||
        (number
          ? column.sqlType !== 'bigint unsigned'
          : column.type !== 'varchar' ||
            column.collation !== 'utf8mb4_bin' ||
            Number(column.length) !==
              ([
                'id',
                'draftId',
                'claimId',
                'applicationId',
                'suiteId',
                'articleId',
              ].includes(name)
                ? 36
                : 128))
      )
        throw new Error(
          `Incompatible Editorial audit authority: ${table}.${name}`
        );
    }
  }

  private async index(
    runner: QueryRunner,
    table: string,
    name: string,
    columns: readonly string[],
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
          Number(row.nonUnique) !== (name === 'PRIMARY' ? 0 : 1) ||
          row.direction !== 'A' ||
          row.visible !== 'YES' ||
          row.expression !== null
      )
    )
      throw new Error(`Incompatible Editorial audit index: ${table}.${name}`);
    return true;
  }
  async down(): Promise<void> {
    throw new Error(
      'Editorial audit erasure requires a reviewed data-preserving rollback'
    );
  }
}
