import { readArticlePublicationSnapshot } from '../articles/mysql-article-snapshot';
import { readReleasePublicationSnapshot } from '../releases/mysql-release-snapshot';
import type { DataSource, EntityManager } from 'typeorm';
import type { EditorialProjectionKind, EditorialSnapshot } from '@apps/shared';
import { readSuitePublicationSnapshot } from '../suites/mysql-suite-snapshot';
import {
  assertEditorialSnapshot,
  EditorialSnapshotReader,
  isEditorialResourceId,
  isEditorialScope,
  projectEditorialSnapshot,
} from '../application/editorial-materialization';

const tables = {
  app: 'app_records',
  category: 'categories',
  tag: 'tags',
} as const;
const relations = [
  {
    field: 'tagIds',
    join: 'app_record_tags',
    column: 'tagsId',
    table: 'tags',
    kind: 'tag',
  },
  {
    field: 'platformIds',
    join: 'app_record_platforms',
    column: 'platformsId',
    table: 'platforms',
  },
  {
    field: 'deviceIds',
    join: 'app_record_devices',
    column: 'devicesId',
    table: 'devices',
  },
  {
    field: 'monetizationModelIds',
    join: 'app_record_monetization',
    column: 'monetizationModelsId',
    table: 'monetization_models',
  },
] as const;

export function editorialSqlInteger(value: unknown, minimum = 0): number {
  const parsed =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  assertEditorialSnapshot(
    typeof parsed === 'number' &&
      Number.isSafeInteger(parsed) &&
      parsed >= minimum,
    'Invalid authoritative SQL integer'
  );
  return parsed;
}

function flag(value: unknown): boolean {
  assertEditorialSnapshot(
    value === 0 || value === 1,
    'Invalid authoritative SQL flag'
  );
  return value === 1;
}

/** All metadata, values and relation IDs come from one consistent InnoDB snapshot. */
export class MysqlEditorialSnapshotReader implements EditorialSnapshotReader {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}

  read(
    kind: EditorialProjectionKind,
    resourceId: string
  ): Promise<EditorialSnapshot> {
    assertEditorialSnapshot(
      kind === 'app' ||
        kind === 'category' ||
        kind === 'tag' ||
        kind === 'suite' ||
        kind === 'article' ||
        kind === 'release',
      'Invalid snapshot resource kind'
    );
    assertEditorialSnapshot(
      isEditorialResourceId(resourceId),
      'Invalid snapshot resource ID'
    );
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      if (kind === 'article')
        return readArticlePublicationSnapshot(manager, resourceId);
      if (kind === 'release')
        return readReleasePublicationSnapshot(manager, resourceId);
      if (kind === 'suite')
        return readSuitePublicationSnapshot(manager, resourceId);
      const [state] = await manager.query<Record<string, unknown>[]>(
        `SELECT tenantId, ownerIdentityId, revision, deletedAt FROM editorial_resource_states WHERE resourceKind = ? AND resourceId = ?`,
        [kind, resourceId]
      );
      if (!state)
        throw new Error('Versioned Editorial resource is unavailable');
      return this.readValues(manager, kind, resourceId, state);
    });
  }

  /** Reuse the exact same bounded value mapping for legacy planning and publication. */
  async readValues(
    manager: EntityManager,
    kind: Exclude<EditorialProjectionKind, 'suite' | 'release' | 'article'>,
    resourceId: string,
    state: Record<string, unknown>
  ): Promise<EditorialSnapshot> {
    assertEditorialSnapshot(
      isEditorialScope(state.tenantId) &&
        (state.ownerIdentityId === null ||
          isEditorialScope(state.ownerIdentityId)),
      'Invalid authoritative ownership'
    );
    const deletedAt =
      state.deletedAt === null ? null : editorialSqlInteger(state.deletedAt);
    const revision = editorialSqlInteger(state.revision, 1);
    const ownFields =
      kind === 'app'
        ? ', description, website, isPwa, rating, estimatedNumberOfUsers, isSuspended, logoUrl, bannerUrl, categoryId, classification'
        : kind === 'category'
        ? ', parentId'
        : '';
    const [row] = await manager.query<Record<string, unknown>[]>(
      `SELECT name, slug, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s.%f') AS createdAtSql,
     DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i:%s.%f') AS updatedAtSql${ownFields} FROM ${tables[kind]} WHERE id = ?`,
      [resourceId]
    );
    assertEditorialSnapshot(row, 'Missing authoritative Editorial values');
    let content: Record<string, unknown> | null = null;
    if (deletedAt === null) {
      if (kind === 'category')
        await this.assertAncestry(
          manager,
          resourceId,
          row.parentId,
          state.tenantId
        );
      if (kind === 'app') {
        if (row.classification === null) delete row.classification;
        row.isPwa = flag(row.isPwa);
        row.isSuspended = flag(row.isSuspended);
        if (row.rating !== null) {
          assertEditorialSnapshot(
            typeof row.rating === 'number' ||
              (typeof row.rating === 'string' &&
                /^\d(?:\.\d)?$/.test(row.rating)),
            'Invalid authoritative rating'
          );
          row.rating = Number(row.rating);
        }
        if (row.estimatedNumberOfUsers !== null)
          row.estimatedNumberOfUsers = editorialSqlInteger(
            row.estimatedNumberOfUsers
          );
        if (row.categoryId !== null)
          await this.assertAncestry(
            manager,
            null,
            row.categoryId,
            state.tenantId
          );
        for (const relation of relations) {
          const rows = await manager.query<
            {
              id: unknown;
              foundId: unknown;
              tenantId: unknown;
              deletedAt: unknown;
            }[]
          >(
            `SELECT r.${relation.column} AS id, target.id AS foundId,
           ${
             'kind' in relation
               ? 's.tenantId, s.deletedAt'
               : 'NULL AS tenantId, NULL AS deletedAt'
           }
           FROM ${relation.join} r LEFT JOIN ${
              relation.table
            } target ON target.id = r.${relation.column}
           ${
             'kind' in relation
               ? `LEFT JOIN editorial_resource_states s ON s.resourceKind = '${relation.kind}' AND s.resourceId = target.id`
               : ''
           }
           WHERE r.appRecordsId = ? ORDER BY r.${relation.column} LIMIT 51`,
            [resourceId]
          );
          assertEditorialSnapshot(
            rows.length <= 50,
            'Editorial relation count exceeds limit'
          );
          for (const ref of rows) {
            assertEditorialSnapshot(
              isEditorialResourceId(ref.id) && ref.foundId === ref.id,
              'Missing authoritative Editorial reference'
            );
            if ('kind' in relation)
              this.assertAccessibleReference(ref, state.tenantId);
          }
          row[relation.field] = rows.map((ref) => ref.id);
        }
      }
      content = row;
    }
    // Canonical validation is shared with publication; never invent missing values.
    const projection = projectEditorialSnapshot({
      kind,
      resourceId,
      tenantId: state.tenantId,
      revision,
      deletedAt,
      content,
    });
    return {
      kind,
      resourceId,
      tenantId: projection.tenantId,
      revision,
      deletedAt,
      content: projection.content,
    };
  }

  private assertAccessibleReference(
    state: { tenantId: unknown; deletedAt: unknown },
    tenantId: string
  ): void {
    assertEditorialSnapshot(
      state.deletedAt === null &&
        (state.tenantId === tenantId ||
          (state.tenantId === null && tenantId === this.publicTenant)),
      'Unavailable or cross-tenant Editorial reference'
    );
  }

  private async assertAncestry(
    manager: EntityManager,
    id: string | null,
    parentId: unknown,
    tenantId: string
  ): Promise<void> {
    const seen = new Set(id ? [id] : []);
    let current = parentId;
    let depth = 0;
    while (current !== null) {
      assertEditorialSnapshot(
        isEditorialResourceId(current) && !seen.has(current) && depth < 64,
        'Invalid, cyclic or excessive Editorial ancestry'
      );
      depth++;
      seen.add(current);
      const [parent] = await manager.query<
        { parentId: unknown; tenantId: unknown; deletedAt: unknown }[]
      >(
        `SELECT c.parentId, s.tenantId, s.deletedAt FROM categories c
         LEFT JOIN editorial_resource_states s ON s.resourceKind = 'category' AND s.resourceId = c.id WHERE c.id = ?`,
        [current]
      );
      assertEditorialSnapshot(parent, 'Missing authoritative parent category');
      this.assertAccessibleReference(parent, tenantId);
      current = parent.parentId;
    }
  }
}
