import type { DataSource } from 'typeorm';
import { parseCatalogQuery } from '@domains/catalog/record';
import { editorialId } from '../../testing/editorial-projection-fixtures';
import { MysqlCatalogAuthority } from './mysql-catalog-authority';

describe('authoritative catalog query construction', () => {
  const root = {
    id: editorialId(10),
    name: 'Root',
    slug: 'root',
    parentId: null,
  };
  const child = {
    id: editorialId(11),
    name: 'Child',
    slug: 'child',
    parentId: root.id,
  };
  const tags = [1, 2].map((value) => ({
    id: editorialId(value),
    name: `Tag ${value}`,
    slug: `tag-${value}`,
  }));
  const execute = jest.fn();
  const transaction = jest.fn((_level, work) => work({ query: execute }));
  const authority = new MysqlCatalogAuthority(
    { transaction } as unknown as DataSource,
    'public'
  );
  beforeEach(() => {
    jest.clearAllMocks();
    execute.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM categories r')) return [root, child];
      if (sql.includes('FROM tags r')) return tags;
      if (sql.includes(' AS total ')) return [{ total: '31' }];
      if (sql.includes('a.id, a.slug, s.revision'))
        return [{ id: editorialId(), slug: 'app', revision: '7' }];
      return [];
    });
  });

  it('binds public scope, all selected tags and descendant categories in one repeatable snapshot', async () => {
    const result = await authority.read(
      parseCatalogQuery({
        category: 'root',
        tags: 'tag-1,tag-2',
        page: '5',
        pageSize: '20',
        sort: 'newest',
      })
    );
    expect(transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function)
    );
    const [sql, params] =
      execute.mock.calls.find(([query]) =>
        query.includes('a.id, a.slug, s.revision')
      ) ?? [];
    expect(sql).toContain(
      'a.isSuspended = 0 AND s.deletedAt IS NULL AND (s.tenantId = ? OR s.resourceId IS NULL)'
    );
    expect(sql).toContain('COUNT(*) FROM app_record_tags');
    expect(sql).toContain(
      'ORDER BY a.createdAt DESC, a.id ASC LIMIT ? OFFSET ?'
    );
    expect(params).toEqual([
      'public',
      root.id,
      child.id,
      tags[0].id,
      tags[1].id,
      2,
      20,
      20,
    ]);
    expect(result).toMatchObject({
      total: 31,
      page: 2,
      records: [{ id: editorialId(), revision: 7 }],
    });
    expect(result.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('escapes literal wildcards without interpolating user search into SQL', async () => {
    await authority.read(parseCatalogQuery({ search: "50%_! '" }));
    const [sql, params] =
      execute.mock.calls.find(([query]) =>
        query.includes('a.id, a.slug, s.revision')
      ) ?? [];
    expect(sql).not.toContain('50%');
    expect(params).toContain('%50!%!_!!%');
    expect(params).toContain("%'%");
  });

  it('binds canonical IDs with unchanged tenant/lifecycle conditions', async () => {
    await authority.read(parseCatalogQuery({ pageSize: '2' }), {
      ids: [editorialId(2), editorialId()],
    });
    const [sql, params] =
      execute.mock.calls.find(([query]) =>
        query.includes('a.id, a.slug, s.revision')
      ) ?? [];
    expect(sql).toContain(
      'a.isSuspended = 0 AND s.deletedAt IS NULL AND (s.tenantId = ? OR s.resourceId IS NULL)'
    );
    expect(sql).toContain('a.id IN (?,?)');
    expect(sql).not.toContain(editorialId());
    expect(params).toEqual(['public', editorialId(2), editorialId(), 2, 0]);
  });

  it('rejects invalid ID selections before opening a transaction', async () => {
    await expect(
      authority.read(parseCatalogQuery({}), { ids: [] })
    ).rejects.toThrow();
    await expect(
      authority.read(parseCatalogQuery({}), { ids: ["' OR 1=1"] })
    ).rejects.toThrow();
    await expect(
      authority.read(parseCatalogQuery({}), {
        ids: new Array(51).fill(editorialId()),
      })
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('changes its signature for taxonomy edits and refuses cycles', async () => {
    const before = await authority.read(parseCatalogQuery({}));
    execute.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM categories r'))
        return [{ ...root, name: 'Renamed' }, child];
      if (sql.includes(' AS total ')) return [{ total: 31 }];
      if (sql.includes('a.id, a.slug, s.revision'))
        return [{ id: editorialId(), slug: 'app', revision: 7 }];
      if (sql.includes('FROM tags r')) return tags;
      return [];
    });
    expect((await authority.read(parseCatalogQuery({}))).signature).not.toBe(
      before.signature
    );
    execute.mockResolvedValue([{ ...root, parentId: root.id }]);
    await expect(authority.read(parseCatalogQuery({}))).rejects.toThrow();
  });
});
