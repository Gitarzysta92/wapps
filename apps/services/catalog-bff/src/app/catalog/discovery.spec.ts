import { of } from 'rxjs';
import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import {
  DiscoveryInputError,
  DiscoveryUnavailableError,
} from '@domains/discovery';
import { PublicDiscoveryService } from './discovery.service';
import { DiscoveryPublicationsClient } from './discovery-publications.client';

function setup() {
  const applications = {
    browse: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }),
  };
  const publications = {
    articles: jest.fn().mockImplementation(async (q) => ({
      items: [],
      total: 0,
      page: q.page,
      pageSize: q.pageSize,
    })),
    suites: jest.fn().mockImplementation(async (q) => ({
      items: [],
      total: 0,
      page: q.page,
      pageSize: q.pageSize,
    })),
  };
  return {
    applications,
    publications,
    service: new PublicDiscoveryService(applications, publications),
  };
}
describe('public discovery source composition', () => {
  it('returns current canonical application tag names separately from filter keys', async () => {
    const h = setup();
    h.applications.browse.mockResolvedValueOnce({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
      items: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          revision: 1,
          slug: 'work',
          name: 'Work',
          description: 'A tool',
          createdAt: '2026-10-13T00:00:00.000Z',
          categories: [],
          tags: [
            {
              id: '10000000-0000-4000-8000-000000000002',
              slug: 'work-tools',
              name: 'Work tools',
            },
          ],
        },
      ],
    });
    const value = await h.service.search({
      type: 'application',
      pageSize: '10',
    });
    expect(value.groups[0].items[0]).toMatchObject({
      tags: ['10000000-0000-4000-8000-000000000002', 'work-tools'],
      tagNames: ['Work tools'],
    });
  });
  it('queries all three sources once with bounded independent pages', async () => {
    const h = setup();
    const result = await h.service.search({
      q: 'work',
      pageSize: '10',
      sort: 'newest',
    });
    expect(result.groups.map((group) => group.kind)).toEqual([
      'application',
      'article',
      'suite',
    ]);
    expect(h.applications.browse).toHaveBeenCalledTimes(1);
    expect(h.publications.articles).toHaveBeenCalledWith({
      q: 'work',
      page: 1,
      pageSize: 10,
      sort: 'newest',
      category: '',
      tag: '',
    });
    expect(h.publications.suites).toHaveBeenCalledWith({
      q: 'work',
      page: 1,
      pageSize: 10,
      sort: 'newest',
    });
  });
  it('does not fetch unselected sources and retains article filters', async () => {
    const h = setup();
    await h.service.search({ type: 'article', category: 'Guides', tag: 'web' });
    expect(h.applications.browse).not.toHaveBeenCalled();
    expect(h.publications.suites).not.toHaveBeenCalled();
    expect(h.publications.articles).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Guides', tag: 'web' })
    );
  });
  it('corrects an out-of-range page with at most one extra source request', async () => {
    const h = setup();
    const result = await h.service.search({ type: 'suite', page: '10000' });
    expect(result.groups[0].page).toBe(1);
    expect(
      h.publications.suites.mock.calls.map(([query]) => query.page)
    ).toEqual([10000, 1]);
    h.publications.suites
      .mockResolvedValueOnce({ items: [], total: 0, page: 10000, pageSize: 20 })
      .mockResolvedValueOnce({ items: [], total: 1, page: 1, pageSize: 20 });
    await expect(
      h.service.search({ type: 'suite', page: '10000' })
    ).rejects.toThrow(DiscoveryUnavailableError);
  });
  it.each(['articles', 'suites'] as const)(
    'fails the whole search on %s outage or malformed evidence',
    async (key) => {
      const h = setup();
      h.publications[key].mockRejectedValueOnce(
        new Error('private diagnostics')
      );
      await expect(h.service.search({ pageSize: '10' })).rejects.toThrow(
        DiscoveryUnavailableError
      );
      h.publications[key].mockResolvedValueOnce({
        items: [],
        total: 10,
        page: 1,
        pageSize: 10,
      });
      await expect(h.service.search({ pageSize: '10' })).rejects.toThrow(
        DiscoveryUnavailableError
      );
    }
  );
  it('rejects unknown/private filters before source I/O', async () => {
    const h = setup();
    await expect(
      h.service.search({ ownerIdentityId: 'private' })
    ).rejects.toThrow(DiscoveryInputError);
    expect(h.applications.browse).not.toHaveBeenCalled();
    expect(h.publications.articles).not.toHaveBeenCalled();
  });
  it('uses bounded publication HTTP reads with no redirect or credential forwarding', async () => {
    const get = jest
      .fn()
      .mockReturnValue(
        of({ data: { items: [], total: 0, page: 1, pageSize: 100 } })
      );
    const client = new DiscoveryPublicationsClient(
      { get } as unknown as HttpService,
      { get: () => 'http://editorial:3333' } as unknown as ConfigService
    );
    expect(
      await client.suites({ q: 'work', page: 1, pageSize: 100, sort: 'newest' })
    ).toMatchObject({ total: 0, pageSize: 100 });
    expect(get).toHaveBeenCalledWith(
      'http://editorial:3333/api/catalog/suites',
      expect.objectContaining({
        timeout: 15000,
        maxRedirects: 0,
        maxContentLength: 2097152,
        headers: { Accept: 'application/json' },
      })
    );
  });
});
