import type { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { PublicProfileFavoriteSelections } from './public-profile-favorite-selections';

const id = '10000000-0000-4000-8000-000000000001';
const parentId = '10000000-0000-4000-8000-000000000002';
const topic = {
  id,
  applicationId: parentId,
  revision: 2,
  title: 'Topic',
  replyCount: 0,
};
const app = {
  id: parentId,
  revision: 1,
  slug: 'current-parent',
  name: 'Parent',
  description: null,
  website: 'https://example.test',
  logoUrl: null,
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
};
describe('public profile favorite content adapter', () => {
  const get = jest.fn();
  const adapter = new PublicProfileFavoriteSelections(
    { get } as unknown as HttpService,
    'http://editorial.test',
    'http://discussion.test'
  );
  beforeEach(() => get.mockReset());
  it('resolves the current parent slug and returns only the public route fields', async () => {
    get
      .mockReturnValueOnce(of({ data: { items: [topic] } }))
      .mockReturnValueOnce(of({ data: { items: [app] } }));
    expect(await adapter.select([{ kind: 'discussions', id }])).toEqual([
      {
        kind: 'discussions',
        id,
        title: 'Topic',
        slug: id,
        applicationSlug: 'current-parent',
      },
    ]);
    expect(get).toHaveBeenNthCalledWith(
      2,
      'http://editorial.test/api/catalog/app-selection',
      {
        params: { ids: parentId },
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        headers: { Accept: 'application/json' },
      }
    );
  });
  it('omits a discussion whose parent is no longer public', async () => {
    get
      .mockReturnValueOnce(of({ data: { items: [topic] } }))
      .mockReturnValueOnce(of({ data: { items: [] } }));
    expect(await adapter.select([{ kind: 'discussions', id }])).toEqual([]);
  });
  it('bounds transport batches and avoids any lookup for an empty saved set', async () => {
    expect(await adapter.select([])).toEqual([]);
    expect(get).not.toHaveBeenCalled();
    get.mockReturnValue(of({ data: { items: [] } }));
    const targets = Array.from({ length: 101 }, (_, index) => ({
      kind: 'applications' as const,
      id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    expect(await adapter.select(targets)).toEqual([]);
    expect(
      get.mock.calls.map(([, config]) => config.params.ids.split(',').length)
    ).toEqual([50, 50, 1]);
    get.mockClear();
    await expect(adapter.select(Array(201).fill(targets[0]))).rejects.toThrow(
      'unavailable'
    );
    await expect(adapter.select([targets[0], targets[0]])).rejects.toThrow(
      'unavailable'
    );
    expect(get).not.toHaveBeenCalled();
  });
  it('fails closed on unrelated/private metadata, duplicates and projection outages', async () => {
    for (const result of [
      of({ data: { items: [{ ...topic, id: parentId }] } }),
      of({ data: { items: [{ ...topic, ownerIdentityId: 'private' }] } }),
      of({ data: { items: [topic, topic] } }),
      throwError(() => new Error('Projection unavailable')),
    ]) {
      get.mockReturnValue(result);
      await expect(
        adapter.select([{ kind: 'discussions', id }])
      ).rejects.toThrow('unavailable');
    }
  });
  it.each([
    'file:///tmp/content',
    'http://user:password@editorial.test',
    'https://editorial.test/private',
    'https://editorial.test/?tenant=private',
  ])('rejects a configured non-origin: %s', (origin) => {
    expect(
      () =>
        new PublicProfileFavoriteSelections(
          { get } as unknown as HttpService,
          origin,
          'http://discussion.test'
        )
    ).toThrow();
  });
});
