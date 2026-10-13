import { CatalogExplorePublicationReader } from './explore-publication-reader';

const id = '10000000-0000-4000-8000-000000000001',
  appId = '10000000-0000-4000-8000-000000000002';
describe('Timeline publication membership', () => {
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
        classification: 'mature',
      };
      const apps = { find: jest.fn().mockResolvedValue(app) };
      const suites = {
        find: jest
          .fn()
          .mockResolvedValue({
            id,
            revision: 3,
            title: 'Suite',
            applicationIds: [appId],
            classification: 'general',
          }),
      };
      const articles = {
        find: jest
          .fn()
          .mockResolvedValue({
            id,
            revision: 3,
            title: 'Article',
            slug: 'article',
            category: 'Guides',
            tags: [],
            classification: 'general',
          }),
      };
      const releases = {
        find: jest
          .fn()
          .mockResolvedValue({
            id,
            revision: 3,
            title: 'Release',
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
        applicationIds: [appId],
      }),
    };
    const unused = { find: jest.fn() };
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
      applicationIds: [],
    });
    await expect(reader.read(candidate, appId)).rejects.toThrow(
      'membership changed'
    );
    expect((await reader.read(candidate)).item.kind).toBe('suite');
  });
});
