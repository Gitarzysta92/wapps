import type { EntityManager, QueryRunner } from 'typeorm';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import { editorialSqlInteger } from '../infrastructure/mysql-editorial-snapshot';

export const EDITORIAL_AUDIT_ERASURE = 'EditorialAuditErasure1791840013000';

export async function editorialAuditErasureApplied(runner: QueryRunner) {
  return (
    (await runner.hasTable('editorial_migrations')) &&
    (
      await runner.query(
        'SELECT name FROM editorial_migrations WHERE name=? LIMIT 1',
        [EDITORIAL_AUDIT_ERASURE]
      )
    ).length > 0
  );
}

/** A timestamp distinguishes intentional anonymity from missing reviewer data without retaining identity. */
export function assertEditorialReviewActor(
  input: {
    actor: unknown;
    owner: string;
    reviewedAt: number | null;
    decided: boolean;
    self?: boolean;
    erasedAt?: unknown;
  },
  anonymous: boolean
) {
  const erased = input.erasedAt !== null && input.erasedAt !== undefined;
  if (!input.decided) {
    if (input.actor !== null || erased)
      throw new Error('Undecided Editorial review has actor attribution');
    return;
  }
  if (
    !isEditorialScope(input.owner) ||
    input.reviewedAt === null ||
    editorialSqlInteger(input.reviewedAt, 1) !== input.reviewedAt
  )
    throw new Error('Invalid Editorial review authority or time');
  if (input.actor === null) {
    if (
      !anonymous ||
      !erased ||
      input.self ||
      editorialSqlInteger(input.erasedAt, 1) < input.reviewedAt
    )
      throw new Error(
        'Anonymous Editorial review has no exact erasure timestamp'
      );
  } else if (
    !isEditorialScope(input.actor) ||
    erased ||
    (input.self ? input.actor !== input.owner : input.actor === input.owner)
  ) {
    throw new Error('Invalid independent Editorial review attribution');
  }
}

export async function recordApplicationOwnershipHistory(
  manager: EntityManager,
  applicationId: string,
  tenantId: string,
  at: number
) {
  if (
    !manager.queryRunner?.isTransactionActive ||
    !isEditorialResourceId(applicationId) ||
    !isEditorialScope(tenantId)
  )
    throw new Error('Ownership history requires canonical authority');
  await manager.query(
    'INSERT INTO application_ownership_history (applicationId,tenantId,establishedAt) VALUES (?,?,?) ON DUPLICATE KEY UPDATE applicationId=applicationId',
    [applicationId, tenantId, editorialSqlInteger(at, 1)]
  );
  const [row]: Record<string, unknown>[] = await manager.query(
    'SELECT tenantId,establishedAt FROM application_ownership_history WHERE applicationId=? FOR UPDATE',
    [applicationId]
  );
  if (
    !row ||
    row.tenantId !== tenantId ||
    editorialSqlInteger(row.establishedAt, 1) > at
  )
    throw new Error('Application ownership history conflicts');
}
