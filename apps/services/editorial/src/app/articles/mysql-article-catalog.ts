import type { DataSource } from 'typeorm';
import {
  articleId,
  articleBrowseTags,
  PROFILE_ARTICLES_PAGE_SIZE,
  articleRevision,
  articleSlug,
  articleTimestamp,
  ArticleUnavailableError,
} from '@domains/publication/article';
import type {
  ArticleCatalogAuthority,
  ArticleCatalogQuery,
  ArticleCatalogSelection,
} from './article-catalog';

export class MysqlArticleCatalog implements ArticleCatalogAuthority {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}
  select(query: ArticleCatalogQuery): Promise<ArticleCatalogSelection> {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const corrupt = await manager.query(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ p.articleId FROM article_publications p
         LEFT JOIN editorial_resource_states e ON e.resourceKind = 'article' AND e.resourceId = p.articleId
         LEFT JOIN article_drafts d ON d.id = p.articleId
         WHERE p.tenantId = ? AND (e.resourceId IS NULL OR e.tenantId <> p.tenantId OR NOT (e.ownerIdentityId <=> p.ownerIdentityId)
           OR (p.ownerIdentityId IS NOT NULL AND (d.id IS NULL OR d.tenantId <> p.tenantId OR d.ownerIdentityId <> p.ownerIdentityId OR (d.deletedAt IS NOT NULL AND e.deletedAt IS NULL)))) LIMIT 1`,
        [this.publicTenant]
      );
      const missing = await manager.query(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ e.resourceId FROM editorial_resource_states e
         LEFT JOIN article_publications p ON p.articleId = e.resourceId
         WHERE e.resourceKind = 'article' AND e.tenantId = ? AND p.articleId IS NULL LIMIT 1`,
        [this.publicTenant]
      );
      if (corrupt.length || missing.length)
        throw new ArticleUnavailableError('Article authority is incomplete');
      const where = `FROM article_publications p JOIN editorial_resource_states e ON e.resourceKind = 'article' AND e.resourceId = p.articleId
        WHERE p.tenantId = ? AND e.tenantId = p.tenantId AND (e.ownerIdentityId <=> p.ownerIdentityId) AND e.deletedAt IS NULL`;
      const predicates: string[] = [],
        args: (string | number)[] = [this.publicTenant];
      if ('ownerIdentityId' in query) {
        predicates.push('p.ownerIdentityId = ?');
        args.push(query.ownerIdentityId);
        if (query.after) {
          predicates.push('p.articleId > ?');
          args.push(query.after);
        }
      } else if ('slug' in query) {
        predicates.push('p.slug = ?');
        args.push(query.slug);
      } else if ('ids' in query) {
        predicates.push(
          `p.articleId IN (${query.ids.map(() => '?').join(',')})`
        );
        args.push(...query.ids);
      } else {
        if (query.q) {
          predicates.push("LOWER(p.title) LIKE LOWER(?) ESCAPE '='");
          args.push(`%${query.q.replace(/[=%_]/g, '=$&')}%`);
        }
        if (query.category) {
          predicates.push('p.category = ?');
          args.push(query.category);
        }
        for (const tag of articleBrowseTags(query)) {
          predicates.push(
            "JSON_CONTAINS(JSON_EXTRACT(p.fields, '$.tags'), JSON_QUOTE(?))"
          );
          args.push(tag);
        }
      }
      const from =
        where + predicates.map((predicate) => ` AND ${predicate}`).join('');
      const [count] = await manager.query<{ total: number | string }[]>(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ COUNT(*) AS total ${from}`,
        args
      );
      const rows = await manager.query<Record<string, unknown>[]>(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ p.articleId AS id, p.slug, e.revision, p.submittedRevision, p.publishedAt, p.updatedAt ${from}
         ORDER BY ${
           'after' in query
             ? 'p.articleId'
             : 'sort' in query && query.sort !== 'newest'
             ? `p.title ${
                 query.sort === 'name-desc' ? 'DESC' : 'ASC'
               }, p.articleId`
             : 'p.publishedAt DESC, p.articleId'
         } LIMIT ? OFFSET ?`,
        [
          ...args,
          'after' in query
            ? PROFILE_ARTICLES_PAGE_SIZE + 1
            : 'ids' in query
            ? query.ids.length
            : 'pageSize' in query
            ? query.pageSize ?? 20
            : 20,
          'page' in query ? (query.page - 1) * (query.pageSize ?? 20) : 0,
        ]
      );
      const total = Number(count.total);
      if (!Number.isSafeInteger(total) || total < 0)
        throw new ArticleUnavailableError('Invalid article catalog size');
      return {
        tenantId: this.publicTenant,
        total,
        items: rows.map((row) => ({
          id: articleId(row.id),
          slug: articleSlug(row.slug),
          revision: articleRevision(Number(row.revision)),
          submittedRevision: articleRevision(Number(row.submittedRevision)),
          publishedAt: articleTimestamp(Number(row.publishedAt)),
          updatedAt: articleTimestamp(Number(row.updatedAt)),
        })),
      };
    });
  }
}
