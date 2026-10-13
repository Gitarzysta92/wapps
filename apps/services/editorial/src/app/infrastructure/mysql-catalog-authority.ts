import { createHash } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  CatalogCategory,
  CatalogFacet,
  CatalogFacets,
  CatalogReadQuery,
  CatalogUnavailableError,
  catalogAppIds,
  catalogQueryParameters,
  catalogSlug,
  parseCatalogQuery,
} from '@domains/catalog/record';
import {
  CatalogAuthority,
  CatalogSelector,
  catalogAncestry,
} from '../application/editorial-catalog';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';
import { editorialSqlInteger } from './mysql-editorial-snapshot';

const select = 'SELECT /*+ MAX_EXECUTION_TIME(3000) */';
const facetLimit = 2000;
const facetTables = {
  categories: 'categories',
  tags: 'tags',
  platforms: 'platforms',
  devices: 'devices',
  monetizations: 'monetization_models',
} as const;
const joins = {
  tags: ['app_record_tags', 'tagsId'],
  platforms: ['app_record_platforms', 'platformsId'],
  devices: ['app_record_devices', 'devicesId'],
  monetizations: ['app_record_monetization', 'monetizationModelsId'],
} as const;

function placeholders(values: unknown[]): string {
  return values.map(() => '?').join(',');
}

function reference(row: Record<string, unknown>): CatalogFacet {
  if (
    !isEditorialResourceId(row.id) ||
    typeof row.name !== 'string' ||
    !row.name.trim() ||
    row.name.length > 255
  )
    throw new CatalogUnavailableError('Invalid catalog reference');
  return { id: row.id, name: row.name, slug: catalogSlug(row.slug) };
}

/** SQL determines public eligibility; projections never choose which records may be exposed. */
export class MysqlCatalogAuthority implements CatalogAuthority {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {
    if (!isEditorialScope(publicTenant))
      throw new Error('Invalid catalog public tenant');
  }

  async read(input: CatalogReadQuery, selector?: CatalogSelector) {
    const query = parseCatalogQuery(catalogQueryParameters(input));
    const slug =
      selector && 'slug' in selector ? catalogSlug(selector.slug) : undefined;
    const ids =
      selector && 'ids' in selector ? catalogAppIds(selector.ids) : undefined;
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const facets = await this.facets(manager);
      const clauses = [
        'a.isSuspended = 0',
        's.deletedAt IS NULL',
        '(s.tenantId = ? OR s.resourceId IS NULL)',
      ];
      const parameters: unknown[] = [this.publicTenant];
      if (slug !== undefined) {
        clauses.push('a.slug = ?');
        parameters.push(slug);
      }
      if (ids) {
        clauses.push(`a.id IN (${placeholders(ids)})`);
        parameters.push(...ids);
      }
      if (query.categories.length) {
        const selected = new Set(query.categories);
        const ids = facets.categories
          .filter((category) =>
            catalogAncestry(category.id, facets.categories).some((parent) =>
              selected.has(parent.slug)
            )
          )
          .map((category) => category.id);
        clauses.push(
          ids.length ? `a.categoryId IN (${placeholders(ids)})` : 'FALSE'
        );
        parameters.push(...ids);
      }
      for (const dimension of [
        'tags',
        'platforms',
        'devices',
        'monetizations',
      ] as const) {
        const selected = query[dimension];
        if (!selected.length) continue;
        const ids = facets[dimension]
          .filter((facet) => selected.includes(facet.slug))
          .map((facet) => facet.id);
        if (
          !ids.length ||
          (dimension === 'tags' && ids.length !== selected.length)
        ) {
          clauses.push('FALSE');
          continue;
        }
        const [table, column] = joins[dimension];
        if (dimension === 'tags') {
          clauses.push(
            `(SELECT COUNT(*) FROM ${table} r WHERE r.appRecordsId = a.id AND r.${column} IN (${placeholders(
              ids
            )})) = ?`
          );
          parameters.push(...ids, ids.length);
        } else {
          clauses.push(
            `EXISTS (SELECT 1 FROM ${table} r WHERE r.appRecordsId = a.id AND r.${column} IN (${placeholders(
              ids
            )}))`
          );
          parameters.push(...ids);
        }
      }
      for (const word of query.search.split(' ').filter(Boolean)) {
        // Escape LIKE metacharacters separately from SQL parameters: searches are literal words.
        const pattern = `%${word.replace(/[!%_]/g, (value) => `!${value}`)}%`;
        clauses.push(
          "(LOWER(a.name) LIKE LOWER(?) ESCAPE '!' OR LOWER(a.description) LIKE LOWER(?) ESCAPE '!' OR LOWER(a.slug) LIKE LOWER(?) ESCAPE '!')"
        );
        parameters.push(pattern, pattern, pattern);
      }
      const from = `FROM app_records a LEFT JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id WHERE ${clauses.join(
        ' AND '
      )}`;
      const [count] = await manager.query<{ total: unknown }[]>(
        `${select} COUNT(*) AS total ${from}`,
        parameters
      );
      const total = editorialSqlInteger(count?.total);
      const page = Math.min(
        query.page,
        Math.max(1, Math.ceil(total / query.pageSize))
      );
      const order =
        query.sort === 'newest'
          ? 'a.createdAt DESC, a.id ASC'
          : `a.name ${query.sort === 'name-desc' ? 'DESC' : 'ASC'}, a.id ASC`;
      const rows = await manager.query<
        { id: unknown; slug: unknown; revision: unknown }[]
      >(
        `${select} a.id, a.slug, s.revision ${from} ORDER BY ${order} LIMIT ? OFFSET ?`,
        [...parameters, query.pageSize, (page - 1) * query.pageSize]
      );
      const records = rows.map((row) => {
        if (!isEditorialResourceId(row.id))
          throw new CatalogUnavailableError('Invalid catalog record ID');
        return {
          id: row.id,
          slug: catalogSlug(row.slug),
          revision:
            row.revision === null ? null : editorialSqlInteger(row.revision, 1),
        };
      });
      const snapshot = {
        tenantId: this.publicTenant,
        records,
        facets,
        total,
        page,
        pageSize: query.pageSize,
      };
      return {
        ...snapshot,
        signature: createHash('sha256')
          .update(JSON.stringify(snapshot))
          .digest('hex'),
      };
    });
  }

  private async facets(manager: EntityManager): Promise<CatalogFacets> {
    const result: CatalogFacets = {
      categories: [],
      tags: [],
      platforms: [],
      devices: [],
      monetizations: [],
    };
    for (const dimension of [
      'categories',
      'tags',
      'platforms',
      'devices',
      'monetizations',
    ] as const) {
      const kind =
        dimension === 'categories'
          ? 'category'
          : dimension === 'tags'
          ? 'tag'
          : null;
      const rows = await manager.query<Record<string, unknown>[]>(
        `${select} r.id, r.slug, r.name${
          dimension === 'categories' ? ', r.parentId' : ''
        }
         FROM ${facetTables[dimension]} r ${
          kind
            ? `LEFT JOIN editorial_resource_states s ON s.resourceKind = ? AND s.resourceId = r.id WHERE s.deletedAt IS NULL AND (s.tenantId = ? OR s.resourceId IS NULL)`
            : ''
        }
         ORDER BY r.id LIMIT ?`,
        [...(kind ? [kind, this.publicTenant] : []), facetLimit + 1]
      );
      if (rows.length > facetLimit)
        throw new CatalogUnavailableError('Catalog taxonomy exceeds limit');
      const values = rows.map((row) => reference(row));
      if (
        new Set(values.map((value) => value.slug)).size !== values.length ||
        new Set(values.map((value) => value.id)).size !== values.length
      )
        throw new CatalogUnavailableError('Ambiguous catalog taxonomy');
      if (dimension === 'categories') {
        result.categories = values.map((value, index): CatalogCategory => {
          const parentId = rows[index].parentId;
          if (parentId !== null && !isEditorialResourceId(parentId))
            throw new CatalogUnavailableError('Invalid catalog parent');
          return { ...value, parentId };
        });
      } else result[dimension] = values;
    }
    for (const category of result.categories)
      catalogAncestry(category.id, result.categories);
    return result;
  }
}
