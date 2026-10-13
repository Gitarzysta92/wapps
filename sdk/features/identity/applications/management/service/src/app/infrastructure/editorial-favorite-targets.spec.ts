import type { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { EditorialFavoriteTargets } from './editorial-favorite-targets';
const target = {
  kind: 'applications',
  id: '019a0010-0000-7000-8000-000000000001',
} as const;
const app = {
  id: target.id,
  revision: 1,
  slug: 'current',
  name: 'Current',
  description: null,
  website: null,
  logoUrl: null,
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
};
describe('Editorial favorite eligibility adapter', () => {
  const get = jest.fn();
  const targets = new EditorialFavoriteTargets(
    { get } as unknown as HttpService,
    'http://editorial.test'
  );
  beforeEach(() => get.mockReset());
  it('accepts only current article selections and rejects projection failures or private metadata', async () => {
    const article = {
      id: target.id,
      revision: 1,
      submittedRevision: 2,
      title: 'Reviewed',
      slug: 'reviewed',
      excerpt: 'Summary.',
      byline: 'Public name',
      category: 'Guides',
      tags: [],
      publishedAt: 100,
      updatedAt: 100,
    };
    get.mockReturnValue(of({ data: { items: [article] } }));
    expect(await targets.available({ ...target, kind: 'articles' })).toBe(true);
    for (const classification of ['general', 'mature']) {
      get.mockReturnValue(
        of({ data: { items: [{ ...article, classification }] } })
      );
      expect(await targets.available({ ...target, kind: 'articles' })).toBe(
        true
      );
    }
    expect(get).toHaveBeenLastCalledWith(
      'http://editorial.test/api/catalog/article-selection',
      expect.objectContaining({
        params: { ids: target.id },
        timeout: 5000,
        maxRedirects: 0,
      })
    );
    get.mockReturnValue(of({ data: { items: [] } }));
    expect(await targets.available({ ...target, kind: 'articles' })).toBe(
      false
    );
    for (const result of [
      of({ data: { items: [{ ...article, ownerIdentityId: 'private' }] } }),
      of({ data: { items: [{ ...article, classification: 'safe' }] } }),
      throwError(() => ({ response: { status: 503 } })),
    ]) {
      get.mockReturnValue(result);
      await expect(
        targets.available({ ...target, kind: 'articles' })
      ).rejects.toThrow('lookup unavailable');
    }
  });
  it('uses the owner service canonical selection with bounded unsigned transport', async () => {
    get.mockReturnValue(of({ data: { items: [app] } }));
    expect(await targets.available(target)).toBe(true);
    for (const classification of ['general', 'mature']) {
      get.mockReturnValue(
        of({ data: { items: [{ ...app, classification }] } })
      );
      expect(await targets.available(target)).toBe(true);
    }
    expect(get).toHaveBeenCalledWith(
      'http://editorial.test/api/catalog/app-selection',
      {
        params: { ids: target.id },
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        headers: { Accept: 'application/json' },
      }
    );
    get.mockReturnValue(of({ data: { items: [] } }));
    expect(await targets.available(target)).toBe(false);
  });
  it('accepts only currently published suite selections and fails closed during projection lag', async () => {
    const suite = {
      id: target.id,
      revision: 2,
      submittedRevision: 1,
      publishedAt: 100,
      title: 'Approved',
      description: '',
      applicationIds: [target.id],
    };
    get.mockReturnValue(of({ data: { items: [suite] } }));
    expect(await targets.available({ ...target, kind: 'suites' })).toBe(true);
    for (const classification of ['general', 'mature']) {
      get.mockReturnValue(
        of({ data: { items: [{ ...suite, classification }] } })
      );
      expect(await targets.available({ ...target, kind: 'suites' })).toBe(true);
    }
    expect(get).toHaveBeenLastCalledWith(
      'http://editorial.test/api/catalog/suite-selection',
      expect.objectContaining({
        params: { ids: target.id },
        timeout: 5000,
        maxRedirects: 0,
      })
    );
    get.mockReturnValue(of({ data: { items: [] } }));
    expect(await targets.available({ ...target, kind: 'suites' })).toBe(false);
    for (const response of [
      of({ data: { items: [app] } }),
      of({ data: { items: [{ ...suite, classification: 'safe' }] } }),
      of({
        data: {
          items: [{ ...suite, id: '019a0010-0000-7000-8000-000000000002' }],
        },
      }),
      throwError(() => ({ response: { status: 503 } })),
    ]) {
      get.mockReturnValue(response);
      await expect(
        targets.available({ ...target, kind: 'suites' })
      ).rejects.toThrow('lookup unavailable');
    }
  });
  it.each(['discussions'] as const)(
    'refuses unsupported %s without fabricating eligibility',
    async (kind) => {
      await expect(targets.available({ ...target, kind })).rejects.toThrow(
        'not yet available'
      );
      expect(get).not.toHaveBeenCalled();
    }
  );
  it('does not turn upstream absence/failure or unrelated metadata into success', async () => {
    for (const result of [
      of({
        data: {
          items: [{ ...app, id: '019a0010-0000-7000-8000-000000000002' }],
        },
      }),
      of({ data: { items: [app, app] } }),
      of({ data: { items: [{ ...app, classification: 'safe' }] } }),
      throwError(() => ({ response: { status: 404 } })),
      throwError(() => new Error('private failure')),
    ]) {
      get.mockReturnValue(result);
      await expect(targets.available(target)).rejects.toThrow(
        'lookup unavailable'
      );
    }
  });
  it.each([
    'file:///tmp/target',
    'http://user:pass@editorial',
    'http://editorial/api',
    'http://editorial/?tenant=private',
  ])('rejects invalid configured origin: %s', (origin) => {
    expect(
      () =>
        new EditorialFavoriteTargets({ get } as unknown as HttpService, origin)
    ).toThrow();
  });
});
