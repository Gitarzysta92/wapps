import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import { lockIdentityWrites } from '@wapps/account-mysql';
import type { DataSource, EntityManager } from 'typeorm';
import {
  parsePrivateSuite,
  parseSuiteReceipt,
  SUITE_LIMITS,
  SuiteConflictError,
  SuiteInputError,
  SuiteNotFoundError,
  SuiteUnavailableError,
  type PrivateSuite,
  type SuiteReceipt,
} from '@domains/publication/suite';
import type { EditorialActor } from '../application/editorial.ports';
import type { SuiteCommand, SuiteWorkspaceStore } from './suite-workspace';
import { deleteSuitePublication } from './suite-publication-state';

interface SuiteRow {
  id: string;
  title: string;
  description: string;
  classification?: unknown;
  applicationIds: unknown;
  revision: string | number;
  createdAt: string | number;
  updatedAt: string | number;
  deletedAt: string | number | null;
}
function snapshot(row: SuiteRow): PrivateSuite {
  try {
    return parsePrivateSuite({
      id: row.id,
      title: row.title,
      description: row.description,
      classification: row.classification ?? undefined,
      applicationIds:
        typeof row.applicationIds === 'string'
          ? JSON.parse(row.applicationIds)
          : row.applicationIds,
      revision: Number(row.revision),
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
      visibility: 'private',
    });
  } catch {
    throw new SuiteUnavailableError('Stored suite is invalid');
  }
}

/** Draft reads remain canonical; approved snapshots have their own publication revision. */
export class MysqlSuiteWorkspace implements SuiteWorkspaceStore {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}

  async list(actor: EditorialActor) {
    const rows = await this.source
      .query<SuiteRow[]>(
        'SELECT * FROM private_suites WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL ORDER BY updatedAt DESC, id LIMIT ?',
        [actor.tenantId, actor.identityId, SUITE_LIMITS.perOwner + 1]
      )
      .catch(() => {
        throw new SuiteUnavailableError('Suite storage is unavailable');
      });
    if (rows.length > SUITE_LIMITS.perOwner)
      throw new SuiteUnavailableError('Suite capacity is invalid');
    return rows.map(snapshot);
  }
  async read(actor: EditorialActor, id: string) {
    const row = await this.row(this.source.manager, actor, id).catch(() => {
      throw new SuiteUnavailableError('Suite storage is unavailable');
    });
    if (!row || row.deletedAt !== null)
      throw new SuiteNotFoundError('Suite not found');
    return snapshot(row);
  }

  async commit(command: SuiteCommand): Promise<SuiteReceipt> {
    try {
      return await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          const { actor, type, key, id, fields } = command;
          await lockIdentityWrites(manager, [actor.identityId]);
          // Serialize owner capacity and idempotency, including concurrent first creates.
          await manager.query(
            'INSERT INTO suite_workspaces (tenantId, ownerIdentityId) VALUES (?, ?) ON DUPLICATE KEY UPDATE ownerIdentityId = ownerIdentityId',
            [actor.tenantId, actor.identityId]
          );
          await manager.query(
            'SELECT ownerIdentityId FROM suite_workspaces WHERE tenantId = ? AND ownerIdentityId = ? FOR UPDATE',
            [actor.tenantId, actor.identityId]
          );
          const [receipt] = await manager.query<
            {
              fingerprint: string;
              suiteId: string;
              revision: string | number;
              deleted: number;
            }[]
          >(
            'SELECT fingerprint, suiteId, revision, deleted FROM suite_commands WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
            [actor.tenantId, actor.identityId, key]
          );
          if (receipt) {
            if (receipt.fingerprint !== command.fingerprint)
              throw new SuiteConflictError(
                'Idempotency-Key was used for another command'
              );
            if (!(await this.row(manager, actor, receipt.suiteId)))
              throw new SuiteUnavailableError(
                'Suite receipt has no canonical owner'
              );
            return parseSuiteReceipt({
              id: receipt.suiteId,
              revision: Number(receipt.revision),
              deleted: receipt.deleted === 1,
            });
          }
          const previous =
            type === 'create' ? null : await this.row(manager, actor, id);
          if (type !== 'create' && (!previous || previous.deletedAt !== null))
            throw new SuiteNotFoundError('Suite not found');
          if (
            previous &&
            Number(previous.revision) !== command.expectedRevision
          )
            throw new SuiteConflictError(
              'Suite changed. Reload before editing.'
            );
          const current = previous ? snapshot(previous) : null;
          const revision = (current?.revision ?? 0) + 1;
          if (!Number.isSafeInteger(revision))
            throw new SuiteConflictError('Suite revision limit reached');
          if (type === 'create') {
            const [count] = await manager.query<{ total: string | number }[]>(
              'SELECT COUNT(*) AS total FROM private_suites WHERE tenantId = ? AND ownerIdentityId = ? AND deletedAt IS NULL',
              [actor.tenantId, actor.identityId]
            );
            if (Number(count.total) >= SUITE_LIMITS.perOwner)
              throw new SuiteConflictError(
                'You can keep at most 100 private suites'
              );
          }
          // Existing references remain removable/editable after target deletion or withdrawal.
          const additions =
            fields?.applicationIds.filter(
              (target) => !current?.applicationIds.includes(target)
            ) ?? [];
          for (const target of [...additions].sort()) {
            const [eligible] = await manager.query<{ id: string }[]>(
              `SELECT a.id FROM app_records a LEFT JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id
             WHERE a.id = ? AND a.isSuspended = 0 AND s.deletedAt IS NULL AND (s.tenantId = ? OR s.resourceId IS NULL) FOR SHARE`,
              [target, this.publicTenant]
            );
            if (!eligible)
              throw new SuiteInputError(
                'A selected application is no longer available'
              );
          }
          const at = Math.max(command.at, current?.updatedAt ?? 0);
          if (type === 'create' && fields) {
            await manager.query(
              'INSERT INTO private_suites (id, tenantId, ownerIdentityId, title, description, applicationIds, classification, revision, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
              [
                id,
                actor.tenantId,
                actor.identityId,
                fields.title,
                fields.description,
                JSON.stringify(fields.applicationIds),
                fields.classification ?? null,
                revision,
                at,
                at,
              ]
            );
          } else {
            await manager.query(
              'UPDATE private_suites SET title = ?, description = ?, applicationIds = ?, classification = ?, revision = ?, updatedAt = ?, deletedAt = ? WHERE id = ? AND tenantId = ? AND ownerIdentityId = ?',
              [
                fields?.title ?? '',
                fields?.description ?? '',
                JSON.stringify(fields?.applicationIds ?? []),
                fields?.classification ?? null,
                revision,
                at,
                type === 'delete' ? at : null,
                id,
                actor.tenantId,
                actor.identityId,
              ]
            );
          }
          if (type === 'delete')
            await deleteSuitePublication(manager, id, actor, at);
          await manager.query(
            'INSERT INTO suite_commands (tenantId, ownerIdentityId, commandKey, fingerprint, suiteId, revision, deleted, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              actor.tenantId,
              actor.identityId,
              key,
              command.fingerprint,
              id,
              revision,
              type === 'delete',
              at,
            ]
          );
          return { id, revision, deleted: type === 'delete' };
        }
      );
    } catch (error) {
      if (
        error instanceof CanonicalIdentityAccessDenied ||
        error instanceof SuiteInputError ||
        error instanceof SuiteConflictError ||
        error instanceof SuiteNotFoundError ||
        error instanceof SuiteUnavailableError
      )
        throw error;
      throw new SuiteUnavailableError(
        'Could not confirm the suite change. Retry with the same Idempotency-Key.'
      );
    }
  }

  private async row(manager: EntityManager, actor: EditorialActor, id: string) {
    const [row] = await manager.query<SuiteRow[]>(
      'SELECT * FROM private_suites WHERE id = ? AND tenantId = ? AND ownerIdentityId = ?',
      [id, actor.tenantId, actor.identityId]
    );
    return row ?? null;
  }
}
