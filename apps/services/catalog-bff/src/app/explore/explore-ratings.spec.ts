import type { ExploreItem } from '@domains/feed';
import { ExploreRatings } from './explore-ratings';
import { HttpExploreReviewSummaries } from './explore-review-summaries';
const id = '10000000-0000-4000-8000-000000000001';
const item: ExploreItem = {
  kind: 'application',
  id,
  at: 1000,
  title: 'App',
  target: { kind: 'application', id, slug: 'app' },
  categories: [],
  tags: [],
  engagement: null,
  details: {
    kind: 'application',
    revision: 2,
    description: 'App preview',
    logoUrl: null,
    bannerUrl: null,
    category: null,
    tags: [],
    reviews: null,
  },
};
describe('current activity ratings', () => {
  it('adds actual counts and rejects a late revision, withdrawal or summary failure', async () => {
    const reviews = {
      read: jest.fn().mockResolvedValue({ total: 2, rating: 4.5 }),
    };
    const applications = {
      find: jest.fn().mockResolvedValue({ id, revision: 2 }),
    };
    const ratings = new ExploreRatings(reviews, applications);
    expect((await ratings.enrich([item]))[0].details).toEqual({
      ...item.details,
      reviews: { total: 2, rating: 4.5 },
    });
    expect(
      item.details?.kind === 'application' && item.details.reviews
    ).toBeNull();
    applications.find.mockResolvedValue({ id, revision: 3 });
    await expect(ratings.enrich([item])).rejects.toThrow('changed');
    applications.find.mockResolvedValue(null);
    await expect(ratings.enrich([item])).rejects.toThrow('changed');
    reviews.read.mockRejectedValue(new Error('offline'));
    await expect(ratings.enrich([item])).rejects.toThrow('offline');
  });
  it('uses the public bounded summary endpoint and validates its aggregate', async () => {
    const response = (value: unknown) =>
      new Response(JSON.stringify(value), {
        headers: { 'content-type': 'application/json' },
      });
    const request = jest
      .fn()
      .mockImplementation(async () =>
        response({ total: 2, average: 4.5, distribution: [0, 0, 0, 1, 1] })
      );
    const client = new HttpExploreReviewSummaries(
      'http://localhost:3001',
      request
    );
    expect(await client.read(id)).toEqual({ total: 2, rating: 4.5 });
    expect(request.mock.calls[0][0]).toBe(
      `http://localhost:3001/api/reviews/summary?bindingKey=wapps%3Aapplication%3A${id}`
    );
    request.mockImplementation(async () =>
      response({ total: 2, average: 5, distribution: [0, 0, 0, 1, 1] })
    );
    await expect(client.read(id)).rejects.toThrow();
    request.mockImplementation(async () => response('x'.repeat(5000)));
    await expect(client.read(id)).rejects.toThrow('exceeds bounds');
    request.mockImplementation(async () => new Response('{}', { status: 503 }));
    await expect(client.read(id)).rejects.toThrow('unavailable');
  });
});
