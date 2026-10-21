import { CatalogExplorePublicationReader } from './explore-publication-reader';

const id = '10000000-0000-4000-8000-000000000001',
  appId = '10000000-0000-4000-8000-000000000002';
describe('Timeline publication membership', () => {
  it('invalidates a suite preview when a selected application changes or becomes unavailable during composition', async () => {
    const member = {
      id: appId,
      slug: 'app',
      name: 'Public member',
      description: 'Description',
      logoUrl: null,
      classification: 'general',
    };
    const apps = {
      find: jest.fn(),
      select: jest.fn().mockResolvedValue({ items: [member] }),
    };
    const suites = {
      find: jest
        .fn()
        .mockResolvedValue({
          id,
          revision: 2,
          title: 'Suite',
          description: 'Reviewed collection',
          applicationIds: [appId],
        }),
    };
    const reader = new CatalogExplorePublicationReader(
      apps,
      suites,
      { find: jest.fn() },
      { find: jest.fn() }
    );
    const result = await reader.read({
      kind: 'suite',
      id,
      at: 1000,
      revision: 2,
      slug: null,
      applicationSlug: null,
      version: null,
    });
    expect(result.item.details).toMatchObject({
      description: 'Reviewed collection',
      applications: [member],
    });
    apps.select.mockResolvedValue({
      items: [{ ...member, classification: 'mature' }],
    });
    await expect(reader.confirm([result.item])).rejects.toThrow(
      'applications changed'
    );
    apps.select.mockResolvedValue({ items: [] });
    await expect(reader.confirm([result.item])).rejects.toThrow(
      'applications changed'
    );
    apps.select.mockRejectedValue(new Error('Projection pending'));
    await expect(
      reader.read({
        kind: 'suite',
        id,
        at: 1000,
        revision: 2,
        slug: null,
        applicationSlug: null,
        version: null,
      })
    ).rejects.toThrow('Projection pending');
  });
  it.each(['application', 'suite', 'article', 'release'] as const)(
    'reads %s classification from its approved publication or parent',
    async (kind) => {
      const app = {
        id: appId,
        revision: 2,
        name: 'App',
        slug: 'app',
        categories: [],
        tags: [],
        description: 'An application preview',
        logoUrl: null,
        bannerUrl: null,
        classification: 'mature',
      };
      const apps = {
        find: jest.fn().mockResolvedValue(app),
        select: jest.fn().mockResolvedValue({ items: [app] }),
      };
      const suites = {
        find: jest.fn().mockResolvedValue({
          id,
          revision: 3,
          title: 'Suite',
          description: 'A collection preview',
          applicationIds: [appId],
          classification: 'general',
        }),
      };
      const articles = {
        find: jest.fn().mockResolvedValue({
          id,
          revision: 3,
          title: 'Article',
          byline: 'Reviewed author',
          excerpt: 'Article preview',
          publishedAt: 1000,
          slug: 'article',
          category: 'Guides',
          tags: [],
          classification: 'general',
        }),
      };
      const releases = {
        find: jest.fn().mockResolvedValue({
          id,
          revision: 3,
          title: 'Release',
          description: 'Release preview',
          releasedOn: '2026-10-13',
          channel: 'stable',
          type: 'patch',
          changes: [{ type: 'fix', description: 'Real fix' }],
          applicationId: appId,
          applicationSlug: 'app',
          version: '1.0.0',
        }),
      };
      const reader = new CatalogExplorePublicationReader(
        apps,
        suites,
        articles,
        releases
      );
      const result = await reader.read({
        kind,
        id: kind === 'application' ? appId : id,
        revision: 3,
        at: 1000,
        slug: 'app',
        applicationSlug: 'app',
        version: '1.0.0',
      });
      expect(result.item.classification).toBe(
        kind === 'application' || kind === 'release' ? 'mature' : 'general'
      );
      expect(result.item.details?.kind).toBe(kind);
      await expect(reader.confirm([result.item])).resolves.toBeUndefined();
      if (kind === 'release') {
        apps.find.mockResolvedValue({ ...app, classification: 'general' });
        await expect(reader.confirm([result.item])).rejects.toThrow(
          'Release application changed'
        );
        apps.find.mockResolvedValue(null);
        await expect(reader.confirm([result.item])).rejects.toThrow(
          'Release application changed'
        );
      }
    }
  );
  it('confirms public suite membership before returning a scoped activity item', async () => {
    const suites = {
      find: jest.fn().mockResolvedValue({
        id,
        revision: 1,
        title: 'Suite',
        description: 'A collection preview',
        applicationIds: [appId],
      }),
    };
    const unused = {
      find: jest.fn(),
      select: jest.fn().mockResolvedValue({ items: [] }),
    };
    const reader = new CatalogExplorePublicationReader(
      unused,
      suites,
      unused,
      unused
    );
    const candidate = {
      kind: 'suite' as const,
      id,
      revision: 1,
      at: 1000,
      slug: null,
      applicationSlug: null,
      version: null,
    };
    expect((await reader.read(candidate, appId)).item.kind).toBe('suite');
    suites.find.mockResolvedValue({
      id,
      revision: 1,
      title: 'Suite',
      description: 'A collection preview',
      applicationIds: ['10000000-0000-4000-8000-000000000003'],
    });
    await expect(reader.read(candidate, appId)).rejects.toThrow(
      'membership changed'
    );
    expect((await reader.read(candidate)).item.kind).toBe('suite');
  });
});
