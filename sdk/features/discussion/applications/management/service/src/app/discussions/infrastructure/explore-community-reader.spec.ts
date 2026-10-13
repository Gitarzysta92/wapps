import type { ExploreItem } from '@domains/feed';
import { PublicExploreCommunityReader } from './explore-community-reader';

const id = '10000000-0000-4000-8000-000000000001';
const applicationId = '10000000-0000-4000-8000-000000000002';
const item: ExploreItem = {
  classification: 'general',
  kind: 'review',
  id,
  at: 1000,
  title: 'Current application',
  target: { kind: 'review', id, applicationId, applicationSlug: 'current' },
  categories: ['productivity'],
  tags: ['offline'],
  engagement: 2,
};
const parent = {
  classification: 'general' as const,
  target: { kind: 'application' as const, id: applicationId },
  slug: 'current',
  title: 'Current application',
  categories: ['productivity'],
  tags: ['offline'],
};

describe('Explore final parent visibility confirmation', () => {
  function setup() {
    const parents = { select: jest.fn().mockResolvedValue([parent]) };
    const reader = new PublicExploreCommunityReader(
      { read: jest.fn() },
      { read: jest.fn() },
      parents
    );
    return { parents, reader };
  }

  it('rechecks the parent after all page items have loaded', async () => {
    const { reader, parents } = setup();
    await expect(reader.confirm([item])).resolves.toBeUndefined();
    expect(parents.select).toHaveBeenCalledWith([parent.target]);
    parents.select.mockResolvedValue([]);
    await expect(reader.confirm([item])).rejects.toThrow('parent changed');
  });

  it.each([
    { classification: 'mature' },
    { classification: undefined },
    { slug: 'renamed' },
    { title: 'Renamed application' },
    { categories: ['other'] },
    { tags: ['other'] },
  ])('rejects changed parent metadata: %j', async (change) => {
    const { reader, parents } = setup();
    parents.select.mockResolvedValue([{ ...parent, ...change }]);
    await expect(reader.confirm([item])).rejects.toThrow('parent changed');
  });

  it('propagates parent authority unavailability', async () => {
    const { reader, parents } = setup();
    parents.select.mockRejectedValue(new Error('parent unavailable'));
    await expect(reader.confirm([item])).rejects.toThrow('parent unavailable');
  });
  it.each(['discussion', 'review'] as const)(
    'inherits %s classification from its current application',
    async (kind) => {
      const parents = {
        select: jest
          .fn()
          .mockResolvedValue([{ ...parent, classification: 'mature' }]),
      };
      const reader = new PublicExploreCommunityReader(
        {
          read: jest
            .fn()
            .mockResolvedValue({
              title: 'Discussion',
              revision: 2,
              comments: [
                { id, content: 'Message', votes: { upvotes: 1, downvotes: 0 } },
              ],
            }),
        },
        {
          read: jest
            .fn()
            .mockResolvedValue({
              revision: 2,
              hidden: false,
              withdrawn: false,
              helpfulCount: 3,
            }),
        },
        parents
      );
      const candidate = { kind, id, at: 1000, revision: 2, applicationId };
      expect((await reader.read(candidate))?.item.classification).toBe(
        'mature'
      );
      parents.select
        .mockResolvedValueOnce([parent])
        .mockResolvedValueOnce([{ ...parent, classification: 'mature' }]);
      await expect(reader.read(candidate)).rejects.toThrow('parent changed');
    }
  );
});
