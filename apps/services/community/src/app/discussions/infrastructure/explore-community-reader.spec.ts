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
  it('returns public discussion excerpts in root-first order and omits redacted replies and private flags', async () => {
    const reply = '10000000-0000-4000-8000-000000000003';
    const reader = new PublicExploreCommunityReader(
      {
        read: jest.fn().mockResolvedValue({
          title: 'Topic',
          revision: 4,
          replyCount: 2,
          comments: [
            {
              id: reply,
              content: {
                displayName: 'Deleted account',
                text: 'Retained reply',
                mentions: ['private'],
              },
              createdAt: 1002,
              editable: true,
            },
            {
              id,
              content: { displayName: 'Public author', text: 'Opening post' },
              createdAt: 1000,
            },
            {
              id: '10000000-0000-4000-8000-000000000004',
              content: null,
              createdAt: null,
            },
          ],
        }),
      },
      { read: jest.fn() },
      { select: jest.fn().mockResolvedValue([parent]) }
    );
    const result = await reader.read({
      kind: 'discussion',
      id,
      at: 1000,
      revision: 4,
      applicationId,
    });
    expect(result?.item.details).toEqual({
      kind: 'discussion',
      applicationName: parent.title,
      replyCount: 2,
      posts: [
        {
          id,
          byline: 'Public author',
          text: 'Opening post',
          publishedAt: 1000,
        },
        {
          id: reply,
          byline: 'Deleted account',
          text: 'Retained reply',
          publishedAt: 1002,
        },
      ],
    });
  });
  it('returns the real review text, attribution and score but omits a moderated or withdrawn review', async () => {
    const value = {
      revision: 3,
      hidden: false,
      withdrawn: false,
      helpfulCount: 2,
      createdAt: 1000,
      content: {
        displayName: 'Deleted account',
        rating: 4,
        text: 'Retained public review',
      },
    };
    const reviews = { read: jest.fn().mockResolvedValue(value) };
    const reader = new PublicExploreCommunityReader(
      { read: jest.fn() },
      reviews,
      { select: jest.fn().mockResolvedValue([parent]) }
    );
    const candidate = {
      kind: 'review' as const,
      id,
      at: 1000,
      revision: 3,
      applicationId,
    };
    expect((await reader.read(candidate))?.item.details).toEqual({
      kind: 'review',
      applicationName: parent.title,
      logoUrl: null,
      byline: 'Deleted account',
      rating: 4,
      text: 'Retained public review',
      publishedAt: 1000,
    });
    reviews.read.mockResolvedValue({ ...value, hidden: true });
    expect(await reader.read(candidate)).toBeNull();
    reviews.read.mockResolvedValue({ ...value, withdrawn: true });
    expect(await reader.read(candidate)).toBeNull();
  });
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
          read: jest.fn().mockResolvedValue({
            title: 'Discussion',
            revision: 2,
            replyCount: 0,
            comments: [
              {
                id,
                content: { displayName: 'Public member', text: 'Message' },
                createdAt: 1000,
                votes: { upvotes: 1, downvotes: 0 },
              },
            ],
          }),
        },
        {
          read: jest.fn().mockResolvedValue({
            revision: 2,
            hidden: false,
            withdrawn: false,
            helpfulCount: 3,
            content: {
              displayName: 'Public reviewer',
              text: 'A review',
              rating: 4,
            },
            createdAt: 1000,
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
