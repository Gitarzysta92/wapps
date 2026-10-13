import { advanceContentUpdateCursor } from '@sdk/extras/mysql';
import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { assertEditorialOwnership } from '../application/editorial-commands';
import {
  EditorialCommandIdentity,
  EditorialConflictError,
  EditorialMutation,
  EditorialReceipt,
  EditorialResourceKind,
  EditorialResourceState,
  EditorialUnavailableError,
  EditorialValidationError,
  EditorialWrites,
} from '../application/editorial.ports';

const tables = {
  app: 'app_records',
  category: 'categories',
  tag: 'tags',
} as const;
const relations = [
  {
    field: 'tagIds',
    table: 'tags',
    join: 'app_record_tags',
    column: 'tagsId',
    kind: 'tag',
  },
  {
    field: 'platformIds',
    table: 'platforms',
    join: 'app_record_platforms',
    column: 'platformsId',
  },
  {
    field: 'deviceIds',
    table: 'devices',
    join: 'app_record_devices',
    column: 'devicesId',
  },
  {
    field: 'monetizationModelIds',
    table: 'monetization_models',
    join: 'app_record_monetization',
    column: 'monetizationModelsId',
  },
] as const;

export function editorialRevision(value: unknown): number {
  const revision =
    typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    throw new EditorialUnavailableError(
      'Invalid authoritative editorial revision'
    );
  return revision;
}

interface StateRow {
  resourceId: string;
  resourceKind: EditorialResourceKind;
  tenantId: string;
  ownerIdentityId: string | null;
  revision: string | number;
  deletedAt: string | number | null;
}

interface ReceiptRow {
  fingerprint: string;
  resourceId: string;
  resourceKind: EditorialResourceKind;
  revision: string | number;
  deleted: number;
}

@Injectable()
export class MysqlEditorialWrites implements EditorialWrites {
  constructor(
    private readonly dataSource: DataSource,
    private readonly publicTenant: string
  ) {}

  async resource(
    kind: EditorialResourceKind,
    id: string
  ): Promise<EditorialResourceState | null> {
    return this.state(this.dataSource.manager, kind, id, false);
  }

  receipt(command: EditorialCommandIdentity) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await lockIdentityWrites(manager, [command.actor.identityId]);
      return this.readReceipt(manager, command);
    });
  }

  async commit(mutation: EditorialMutation): Promise<EditorialReceipt> {
    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          await lockIdentityWrites(manager, [
            mutation.command.actor.identityId,
          ]);
          const replay = await this.readReceipt(manager, mutation.command);
          if (replay) return replay;
          const { kind, id, previous, command, fields, at } = mutation;
          let revision = 1;
          if (mutation.type !== 'create') {
            const existing = await manager.query<{ id: string }[]>(
              `SELECT id FROM ${tables[kind]} WHERE id = ? FOR UPDATE`,
              [id]
            );
            const current = await this.state(manager, kind, id, true);
            if (!existing.length || !current || !previous)
              throw new EditorialConflictError(
                'Authoritative resource is missing'
              );
            assertEditorialOwnership(command.actor, current);
            const serializedReplay = await this.readReceipt(manager, command);
            if (serializedReplay) return serializedReplay;
            if (
              current.deletedAt !== null ||
              current.revision !== previous.revision ||
              current.ownerIdentityId !== previous.ownerIdentityId ||
              current.tenantId !== previous.tenantId
            )
              throw new EditorialConflictError(
                'Resource changed before commit'
              );
            revision = editorialRevision(current.revision + 1);
          }
          if (mutation.type === 'delete') {
            await this.assertUnused(manager, kind, id);
          } else {
            if (kind === 'category' && fields.parentId)
              await this.assertParent(
                manager,
                id,
                fields.parentId,
                command.actor.tenantId
              );
            if (kind === 'app') {
              if (fields.categoryId)
                await this.assertReference(
                  manager,
                  'categories',
                  fields.categoryId,
                  command.actor.tenantId,
                  'category'
                );
              for (const relation of relations)
                for (const reference of fields[relation.field] ?? [])
                  await this.assertReference(
                    manager,
                    relation.table,
                    reference,
                    command.actor.tenantId,
                    'kind' in relation ? relation.kind : undefined
                  );
            }
            // DATETIME has no timezone. Serialize UTC explicitly rather than relying on the SQL driver's local timezone.
            const timestamp = new Date(at)
              .toISOString()
              .slice(0, 23)
              .replace('T', ' ');
            const values: Record<string, string | boolean | null> = {
              updatedAt: timestamp,
            };
            for (const field of [
              'name',
              'slug',
              'description',
              'website',
              'logoUrl',
              'bannerUrl',
              'isPwa',
              'categoryId',
              'parentId',
            ] as const) {
              const value = fields[field];
              if (value !== undefined) values[field] = value;
            }
            if (kind === 'app') values.classification = null;
            if (mutation.type === 'create') {
              values.id = id;
              values.createdAt = timestamp;
              if (kind === 'app') values.isPwa ??= false;
              const keys = Object.keys(values);
              await manager.query(
                `INSERT INTO ${tables[kind]} (${keys
                  .map((key) => `\`${key}\``)
                  .join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
                Object.values(values)
              );
            } else {
              await manager.query(
                `UPDATE ${tables[kind]} SET ${Object.keys(values)
                  .map((key) => `\`${key}\` = ?`)
                  .join(', ')} WHERE id = ?`,
                [...Object.values(values), id]
              );
            }
            if (kind === 'app') {
              for (const relation of relations) {
                const references = fields[relation.field];
                if (references === undefined) continue;
                await manager.query(
                  `DELETE FROM ${relation.join} WHERE appRecordsId = ?`,
                  [id]
                );
                for (const reference of references)
                  await manager.query(
                    `INSERT INTO ${relation.join} (appRecordsId, ${relation.column}) VALUES (?, ?)`,
                    [id, reference]
                  );
              }
            }
          }
          const deleted = mutation.type === 'delete';
          if (mutation.type === 'create') {
            await manager.query(
              `INSERT INTO editorial_resource_states (resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt) VALUES (?, ?, ?, ?, 1, NULL)`,
              [kind, id, command.actor.tenantId, command.actor.identityId]
            );
          } else {
            await manager.query(
              `UPDATE editorial_resource_states SET revision = ?, deletedAt = ? WHERE resourceKind = ? AND resourceId = ?`,
              [revision, deleted ? at : null, kind, id]
            );
          }
          await manager.query(
            `INSERT INTO editorial_commands (tenantId, actorIdentityId, commandKey, fingerprint, resourceKind, resourceId, revision, deleted, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              command.actor.tenantId,
              command.actor.identityId,
              command.key,
              command.fingerprint,
              kind,
              id,
              revision,
              deleted,
              at,
            ]
          );
          await manager.query(
            `INSERT INTO editorial_outbox (resourceKind, resourceId, tenantId, revision, operation, actorIdentityId, createdAt, availableAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              kind,
              id,
              command.actor.tenantId,
              revision,
              mutation.type,
              command.actor.identityId,
              at,
              at,
            ]
          );
          if (kind === 'app' && !deleted)
            await advanceContentUpdateCursor(manager, 'applications', id, at);
          return { id, kind, revision, deleted, projection: 'pending' };
        }
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        const replay = await this.receipt(mutation.command);
        if (replay) return replay;
        throw new EditorialConflictError(
          'Resource slug or command identity already exists'
        );
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        [
          'ER_LOCK_DEADLOCK',
          'ER_LOCK_WAIT_TIMEOUT',
          'PROTOCOL_CONNECTION_LOST',
          'ECONNRESET',
          'ECONNREFUSED',
        ].includes(String(error.code))
      )
        throw new EditorialUnavailableError(
          'Editorial storage is temporarily unavailable; retry with the same Idempotency-Key'
        );
      throw error;
    }
  }

  private async state(
    manager: EntityManager,
    kind: EditorialResourceKind,
    id: string,
    lock: boolean
  ): Promise<EditorialResourceState | null> {
    const [row] = await manager.query<StateRow[]>(
      `SELECT resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt FROM editorial_resource_states WHERE resourceKind = ? AND resourceId = ?${
        lock ? ' FOR UPDATE' : ''
      }`,
      [kind, id]
    );
    return row
      ? {
          kind: row.resourceKind,
          id: row.resourceId,
          tenantId: row.tenantId,
          ownerIdentityId: row.ownerIdentityId,
          revision: editorialRevision(row.revision),
          deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
        }
      : null;
  }

  private async readReceipt(
    manager: EntityManager,
    command: EditorialCommandIdentity
  ): Promise<EditorialReceipt | null> {
    const [row] = await manager.query<ReceiptRow[]>(
      `SELECT fingerprint, resourceKind, resourceId, revision, deleted FROM editorial_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?`,
      [command.actor.tenantId, command.actor.identityId, command.key]
    );
    if (!row) return null;
    if (row.fingerprint !== command.fingerprint)
      throw new EditorialConflictError(
        'Idempotency-Key was already used for another command'
      );
    // Receipts are immutable outcomes, not enduring permission to access a resource.
    const current = await this.state(
      manager,
      row.resourceKind,
      row.resourceId,
      true
    );
    if (!current)
      throw new EditorialUnavailableError(
        'Committed resource ownership is missing'
      );
    assertEditorialOwnership(command.actor, current);
    return {
      id: row.resourceId,
      kind: row.resourceKind,
      revision: editorialRevision(row.revision),
      deleted: row.deleted === 1,
      projection: 'pending',
    };
  }

  private async assertReference(
    manager: EntityManager,
    table: string,
    id: string,
    tenant: string,
    kind?: EditorialResourceKind
  ) {
    const rows = await manager.query<{ id: string }[]>(
      `SELECT id FROM ${table} WHERE id = ? FOR UPDATE`,
      [id]
    );
    if (!rows.length)
      throw new EditorialValidationError('Referenced resource does not exist');
    if (!kind) return;
    const state = await this.state(manager, kind, id, true);
    if (
      state
        ? state.deletedAt !== null || state.tenantId !== tenant
        : tenant !== this.publicTenant
    )
      throw new EditorialValidationError(
        'Referenced resource is unavailable in this tenant'
      );
  }

  private async assertParent(
    manager: EntityManager,
    id: string,
    parent: string,
    tenant: string
  ) {
    const seen = new Set([id]);
    let current: string | null = parent;
    while (current) {
      if (seen.has(current) || seen.size > 64)
        throw new EditorialValidationError(
          'Category hierarchy is cyclic or exceeds depth 64'
        );
      seen.add(current);
      await this.assertReference(
        manager,
        'categories',
        current,
        tenant,
        'category'
      );
      const [row]: { parentId: string | null }[] = await manager.query(
        `SELECT parentId FROM categories WHERE id = ?`,
        [current]
      );
      current = row.parentId;
    }
  }

  private async assertUnused(
    manager: EntityManager,
    kind: EditorialResourceKind,
    id: string
  ) {
    if (kind === 'app') return;
    const usedByApp =
      kind === 'category'
        ? 'a.categoryId = ?'
        : 'a.id IN (SELECT appRecordsId FROM app_record_tags WHERE tagsId = ?)';
    const apps = await manager.query<{ id: string }[]>(
      `SELECT a.id FROM app_records a LEFT JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id WHERE ${usedByApp} AND s.deletedAt IS NULL LIMIT 1 FOR UPDATE`,
      [id]
    );
    if (apps.length)
      throw new EditorialConflictError(
        'Resource is referenced by an active app'
      );
    if (kind === 'category') {
      const children = await manager.query<{ id: string }[]>(
        `SELECT c.id FROM categories c LEFT JOIN editorial_resource_states s ON s.resourceKind = 'category' AND s.resourceId = c.id WHERE c.parentId = ? AND s.deletedAt IS NULL LIMIT 1 FOR UPDATE`,
        [id]
      );
      if (children.length)
        throw new EditorialConflictError('Category has active children');
    }
  }
}
