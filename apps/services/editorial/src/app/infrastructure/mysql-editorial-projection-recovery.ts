import type { DataSource, EntityManager } from 'typeorm';
import type {
  EditorialRecoveryCursor,
  EditorialRecoveryResource,
  EditorialRecoverySource,
} from '../application/editorial-projection-recovery';
import {
  assertEditorialSnapshot,
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import { editorialSqlInteger } from './mysql-editorial-snapshot';

function cursor(row: Record<string, unknown>): EditorialRecoveryCursor {
  assertEditorialSnapshot(
    (row.kind === 'app' ||
      row.kind === 'category' ||
      row.kind === 'tag' ||
      row.kind === 'suite' ||
      row.kind === 'article' ||
      row.kind === 'release') &&
      isEditorialResourceId(row.resourceId),
    'Invalid authoritative recovery identity'
  );
  return { kind: row.kind, resourceId: row.resourceId };
}

function resource(row: Record<string, unknown>): EditorialRecoveryResource {
  assertEditorialSnapshot(
    isEditorialScope(row.tenantId),
    'Invalid authoritative recovery tenant'
  );
  return {
    ...cursor(row),
    tenantId: row.tenantId,
    revision: editorialSqlInteger(row.revision, 1),
    deletedAt:
      row.deletedAt === null ? null : editorialSqlInteger(row.deletedAt),
  };
}

export class MysqlEditorialProjectionRecovery
  implements EditorialRecoverySource
{
  constructor(
    private readonly source: DataSource,
    private readonly now: () => number = Date.now
  ) {}

  async ceiling(): Promise<EditorialRecoveryCursor | null> {
    const [row] = await this.source.query<Record<string, unknown>[]>(
      'SELECT resourceKind AS kind, resourceId FROM editorial_resource_states ORDER BY resourceKind DESC, resourceId DESC LIMIT 1'
    );
    return row ? cursor(row) : null;
  }

  async page(
    after: EditorialRecoveryCursor | null,
    through: EditorialRecoveryCursor,
    limit: number
  ): Promise<EditorialRecoveryResource[]> {
    assertEditorialSnapshot(
      Number.isSafeInteger(limit) && limit > 0 && limit <= 100,
      'Invalid recovery page limit'
    );
    const rows = await this.source.query<Record<string, unknown>[]>(
      `SELECT resourceKind AS kind, resourceId, tenantId, revision, deletedAt FROM editorial_resource_states
       WHERE (resourceKind > ? OR (resourceKind = ? AND resourceId > ?))
       AND (resourceKind < ? OR (resourceKind = ? AND resourceId <= ?))
       ORDER BY resourceKind, resourceId LIMIT ?`,
      [
        after?.kind ?? '',
        after?.kind ?? '',
        after?.resourceId ?? '',
        through.kind,
        through.kind,
        through.resourceId,
        limit,
      ]
    );
    return rows.map(resource);
  }

  current(
    id: EditorialRecoveryCursor
  ): Promise<EditorialRecoveryResource | null> {
    return this.read(this.source.manager, id, false);
  }

  enqueue(expected: EditorialRecoveryResource): Promise<boolean> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, expected, true);
      if (
        !current ||
        current.revision !== expected.revision ||
        current.tenantId !== expected.tenantId ||
        current.deletedAt !== expected.deletedAt
      )
        return false;
      const at = this.now();
      await manager.query(
        `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt)
         VALUES (?, ?, ?, ?, 'rebuild', 'system:editorial-rebuild', ?, ?)
         ON DUPLICATE KEY UPDATE deliveredAt = NULL, failedAt = NULL, attempts = 0, availableAt = VALUES(availableAt),
         leaseToken = NULL, leasedUntil = NULL, lastError = NULL`,
        [
          current.kind,
          current.resourceId,
          current.tenantId,
          current.revision,
          at,
          at,
        ]
      );
      return true;
    });
  }

  private async read(
    manager: EntityManager,
    id: EditorialRecoveryCursor,
    lock: boolean
  ): Promise<EditorialRecoveryResource | null> {
    const [row] = await manager.query<Record<string, unknown>[]>(
      `SELECT resourceKind AS kind, resourceId, tenantId, revision, deletedAt FROM editorial_resource_states WHERE resourceKind = ? AND resourceId = ?${
        lock ? ' FOR UPDATE' : ''
      }`,
      [id.kind, id.resourceId]
    );
    return row ? resource(row) : null;
  }
}
