import type { ExploreItem } from '@domains/feed';
import { mapExploreFeedItem } from './explore-feed-item.mapper';

const id = '10000000-0000-4000-8000-000000000001';
const base = {
  id,
  title: 'Published title',
  at: 1780000000000,
  categories: [],
  tags: [],
  engagement: null,
};
const link = jest.fn(
  (target) =>
    `/${target.kind}/${target.slug ?? target.id ?? target.applicationSlug}`
);

describe('Explore mapping into the accepted Home cards', () => {
  beforeEach(() => link.mockClear());

  it('keeps logos separate from banners and preserves zero reviews versus unavailable ratings', () => {
    const item: ExploreItem = {
      ...base,
      kind: 'application',
      target: { kind: 'application', id, slug: 'published-app' },
      details: {
        kind: 'application',
        revision: 7,
        description: 'Published description',
        logoUrl: 'https://example.test/logo.png',
        bannerUrl: null,
        category: { name: 'Design', slug: 'design' },
        tags: [{ name: 'Drawing', slug: 'drawing' }],
        reviews: { total: 0, rating: null },
      },
    };
    expect(mapExploreFeedItem(item, link)).toMatchObject({
      type: 'application-teaser-feed-item',
      appId: id,
      appSlug: 'published-app',
      avatarUrl: 'https://example.test/logo.png',
      coverImage: null,
      reviewsCount: 0,
      aggregatedScore: null,
      category: { link: '/category/design' },
      tags: [{ link: '/tag/drawing' }],
    });
    expect(
      mapExploreFeedItem(
        {
          ...item,
          details: {
            ...item.details!,
            kind: 'application',
            revision: 7,
            description: '',
            logoUrl: null,
            bannerUrl: null,
            category: null,
            tags: [],
            reviews: null,
          },
        },
        link
      )
    ).toMatchObject({ reviewsCount: null, aggregatedScore: null });
  });

  it('uses the published article identity, byline, date and protected cover without inventing votes or comments', () => {
    const item: ExploreItem = {
      ...base,
      kind: 'article',
      target: { kind: 'article', id, slug: 'a-different-slug' },
      details: {
        kind: 'article',
        byline: 'Actual author',
        excerpt: 'Published text',
        category: 'Engineering',
        publishedAt: 1770000000000,
        cover: { imageId: id, alt: 'Published cover' },
        tags: [],
      },
    };
    expect(mapExploreFeedItem(item, link)).toMatchObject({
      id,
      type: 'article-highlight-feed-item',
      articleLink: '/article/a-different-slug',
      author: 'Actual author',
      publicationDate: 1770000000000,
      publishedCover: { imageId: id, alt: 'Published cover' },
      coverImage: null,
      localVoting: false,
      upvotesCount: null,
      commentsCount: null,
    });
  });

  it('keeps the authoritative suite total when the preview contains fewer visible members', () => {
    const item: ExploreItem = {
      ...base,
      kind: 'suite',
      target: { kind: 'suite', id },
      details: {
        kind: 'suite',
        description: 'Published collection',
        applicationCount: 9,
        applications: [
          {
            id,
            slug: 'app',
            name: 'Visible app',
            description: 'Description',
            logoUrl: null,
          },
        ],
      },
    };
    expect(mapExploreFeedItem(item, link)).toMatchObject({
      type: 'suite-teaser-feed-item',
      suiteLink: `/suite/${id}`,
      applicationCount: 9,
      apps: [{ name: 'Visible app', logo: '' }],
      category: 'Category unavailable',
    });
  });

  it('links a review to its exact identity and keeps helpful marks separate from generic votes', () => {
    const item: ExploreItem = {
      ...base,
      kind: 'review',
      engagement: 8,
      target: { kind: 'review', id, applicationId: id, applicationSlug: 'app' },
      details: {
        kind: 'review',
        applicationName: 'App',
        logoUrl: null,
        byline: 'Published reviewer',
        rating: 4,
        text: 'Actual review',
        publishedAt: 1770000000000,
      },
    };
    const card = mapExploreFeedItem(item, link);
    expect(card).toMatchObject({
      type: 'application-review-feed-item',
      reviewLink: `/review/${id}`,
      helpfulCount: 8,
      localVoting: false,
      reviewerBadges: [],
    });
    expect(card).not.toHaveProperty('voting');
  });

  it('uses real release changes and the exact version destination', () => {
    const item: ExploreItem = {
      ...base,
      kind: 'release',
      target: {
        kind: 'release',
        id,
        applicationId: id,
        applicationSlug: 'app',
        version: '2.0+stable',
      },
      details: {
        kind: 'release',
        applicationName: 'App',
        logoUrl: null,
        description: 'New version',
        releasedOn: '2026-10-19',
        channel: 'stable',
        releaseType: 'major',
        changeCount: 8,
        changes: [{ type: 'feature', description: 'New feature' }],
      },
    };
    expect(mapExploreFeedItem(item, link)).toMatchObject({
      type: 'application-dev-log-feed-item',
      version: '2.0+stable',
      changeCount: 8,
      changes: [{ type: 'feature', description: 'New feature' }],
      commentsNumber: null,
      localVoting: false,
    });
    expect(link).toHaveBeenCalledWith(item.target);
  });

  it('does not infer discussion participants or views from a bounded post preview', () => {
    const item: ExploreItem = {
      ...base,
      kind: 'discussion',
      target: {
        kind: 'discussion',
        id,
        applicationId: id,
        applicationSlug: 'app',
      },
      details: {
        kind: 'discussion',
        applicationName: 'App',
        replyCount: 15,
        posts: [
          {
            id,
            byline: 'Actual member',
            text: 'Opening text',
            publishedAt: 1770000000000,
          },
        ],
      },
    };
    expect(mapExploreFeedItem(item, link)).toMatchObject({
      type: 'discussion-topic-feed-item',
      discussionSlug: id,
      replyCount: 15,
      participantsCount: null,
      viewsCount: null,
      discussionData: {
        messages: [{ id, author: 'Actual member', content: 'Opening text' }],
      },
    });
  });

  it('leaves missing previews unavailable instead of falling back to demo content', () => {
    expect(
      mapExploreFeedItem(
        { ...base, kind: 'suite', target: { kind: 'suite', id } },
        link
      )
    ).toBeNull();
    expect(link).not.toHaveBeenCalled();
  });
});
