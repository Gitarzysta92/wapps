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
    select: jest.fn().mockResolvedValue({ items: [] }),
    browse: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }),
  };
  const publications = {
    suiteSelection: jest.fn().mockResolvedValue({ items: [] }),
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
  const reviews = { read: jest.fn().mockResolvedValue({ total: 0, rating: null, preview: null }) };
  return {
    applications,
    publications,
    reviews,
    service: new PublicDiscoveryService(applications, publications, reviews),
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
          logoUrl: 'https://example.test/logo.png',
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
    h.applications.select.mockResolvedValueOnce({ items: [{ id: '10000000-0000-4000-8000-000000000001', revision: 1 }] });
    const value = await h.service.search({
      type: 'application',
      pageSize: '10',
    });
    expect(value.groups[0].items[0]).toMatchObject({
      tags: ['10000000-0000-4000-8000-000000000002', 'work-tools'],
      tagNames: ['Work tools'],
      displayTags: [{ slug: 'work-tools', name: 'Work tools' }],
      details: { kind: 'application', logoUrl: 'https://example.test/logo.png', reviews: { total: 0, rating: null, preview: null } },
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
  it('carries reviewed article media and attribution without private payload fields', async () => {
    const h = setup();
    h.publications.articles.mockResolvedValueOnce({ page: 1, pageSize: 20, total: 1, items: [{
      id: '10000000-0000-4000-8000-000000000001', revision: 4, slug: 'guide', title: 'Guide',
      excerpt: 'An excerpt', byline: 'Writer', category: 'Guides', tags: ['web'], publishedAt: 1000,
      cover: { imageId: '10000000-0000-4000-8000-000000000002', alt: 'Cover' }, classification: 'general',
      ownerIdentityId: 'never expose',
    }] });
    const response = await h.service.search({ type: 'article' });
    expect(response.groups[0].items[0]).toMatchObject({ details: {
      kind: 'article', byline: 'Writer', cover: { imageId: '10000000-0000-4000-8000-000000000002', alt: 'Cover' },
    } });
    expect(JSON.stringify(response)).not.toContain('never expose');
  });
  it('loads bounded public suite members in authored order and rechecks publication after enrichment', async () => {
    const h = setup(), id = '10000000-0000-4000-8000-000000000001';
    const ids = Array.from({ length: 8 }, (_, i) => id.slice(0, -1) + (i + 2));
    const suite = { id, revision: 3, title: 'Tools', description: 'A suite', publishedAt: 1000, applicationIds: ids, classification: 'general' };
    const members = ids.slice(0, 5).map((id, i) => ({ id, revision: 1, slug: 'app-' + i, name: 'App ' + i, logoUrl: null, classification: i === 0 ? 'general' : 'mature' }));
    h.publications.suites.mockResolvedValue({ page: 1, pageSize: 20, total: 1, items: [suite] });
    h.applications.select.mockResolvedValue({ items: [...members].reverse() });
    h.publications.suiteSelection.mockResolvedValue({ items: [suite] });
    const response = await h.service.search({ type: 'suite' });
    expect(h.applications.select).toHaveBeenCalledWith(ids.slice(0, 6));
    expect(response.groups[0].items[0].details).toMatchObject({ applicationCount: 8, applications: members.map(({ id, slug, name, logoUrl, classification }) => ({ id, slug, name, logoUrl, classification })) });
    h.publications.suiteSelection.mockResolvedValueOnce({ items: [] });
    await expect(h.service.search({ type: 'suite' })).rejects.toThrow(DiscoveryUnavailableError);
    h.publications.suiteSelection.mockResolvedValueOnce({ items: [{ ...suite, revision: 4 }] });
    await expect(h.service.search({ type: 'suite' })).rejects.toThrow(DiscoveryUnavailableError);
  });
  it('rejects stale application previews and fails truthfully when reviews are unavailable', async () => {
    const h = setup(), app = { id: '10000000-0000-4000-8000-000000000001', revision: 1, slug: 'work', name: 'Work',
      description: '', logoUrl: null, categories: [], tags: [], createdAt: '2026-10-13T00:00:00Z', classification: 'general' };
    h.applications.browse.mockResolvedValue({ page: 1, pageSize: 20, total: 1, totalPages: 1, items: [app] });
    for (const current of [[], [{ ...app, revision: 2 }], [{ ...app, classification: 'mature' }]]) {
      h.applications.select.mockResolvedValueOnce({ items: current });
      await expect(h.service.search({ type: 'application' })).rejects.toThrow(DiscoveryUnavailableError);
    }
    h.reviews.read.mockRejectedValueOnce(new Error('unavailable'));
    await expect(h.service.search({ type: 'application' })).rejects.toThrow(DiscoveryUnavailableError);
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
