import type { DataSource } from 'typeorm';
import { parseArticleBrowseQuery } from '@domains/publication/article';
import { MysqlArticleCatalog } from './mysql-article-catalog';

describe('article catalog authoritative tag intersection', () => {
  it('uses all tags in both the count and page query, retaining canonical tenant and lifecycle checks', async () => {
    const execute = jest.fn<Promise<unknown[]>, [string, unknown[]]>(
      async (sql) => (sql.includes('COUNT(*)') ? [{ total: 0 }] : [])
    );
    const transaction = jest.fn(async (_level, work) =>
      work({ query: execute })
    );
    const authority = new MysqlArticleCatalog(
      { transaction } as unknown as DataSource,
      'public'
    );
    await authority.select(
      parseArticleBrowseQuery({
        q: '%_=',
        category: 'Guides',
        tag: 'web',
        tags: 'privacy,web',
        page: '2',
        pageSize: '10',
        sort: 'name',
      })
    );
    expect(transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function)
    );
    const [count, page] = execute.mock.calls.slice(-2);
    for (const [sql, parameters] of [count, page]) {
      expect(sql).toContain('e.tenantId = p.tenantId');
      expect(sql).toContain(
        '(e.ownerIdentityId <=> p.ownerIdentityId) AND e.deletedAt IS NULL'
      );
      expect(sql.match(/JSON_CONTAINS/g)).toHaveLength(2);
      expect(sql).not.toContain('privacy');
      expect(parameters.slice(0, 5)).toEqual([
        'public',
        '%=%=_==%',
        'Guides',
        'privacy',
        'web',
      ]);
    }
    expect(page[0]).toContain(
      'ORDER BY p.title ASC, p.articleId LIMIT ? OFFSET ?'
    );
    expect(page[1].slice(-2)).toEqual([10, 10]);
  });
});
