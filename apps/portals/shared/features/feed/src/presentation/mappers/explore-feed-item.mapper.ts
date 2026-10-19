import type { ExploreItem } from '@domains/feed';
import type { ExploreLinkTarget } from '../../application/explore.port';
import {
  APPLICATION_TEASER_FEED_ITEM_SELECTOR,
  type ApplicationTeaserFeedItemVM,
} from '../feed-items/application-teaser-feed-item.component';
import {
  ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
  type ArticleHighlightFeedItemVM,
} from '../feed-items/article-highlight-feed-item.component';
import {
  SUITE_TEASER_FEED_ITEM_SELECTOR,
  type SuiteTeaserFeedItemVM,
} from '../feed-items/suite-teaser-feed-item.component';
import {
  APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
  type ApplicationReviewFeedItemVM,
} from '../feed-items/application-review-feed-item.component';
import {
  APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
  type ApplicationDevLogFeedItemVM,
} from '../feed-items/application-dev-log-feed-item.component';
import {
  DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
  type DiscussionTopicFeedItemVM,
} from '../feed-items/discussion-topic-feed-item.component';

export type ExploreFeedItemVM =
  | ApplicationTeaserFeedItemVM
  | ArticleHighlightFeedItemVM
  | SuiteTeaserFeedItemVM
  | ApplicationReviewFeedItemVM
  | ApplicationDevLogFeedItemVM
  | DiscussionTopicFeedItemVM;

/** Adapt authoritative previews to the accepted cards; absent metrics stay unknown. */
export function mapExploreFeedItem(
  item: ExploreItem,
  link: (target: ExploreLinkTarget) => string
): ExploreFeedItemVM | null {
  const details = item.details;
  const target = item.target;
  if (!details || details.kind !== target.kind) return null;
  const common = {
    id: item.id,
    title: item.title,
    subtitle: '',
    timestamp: new Date(item.at),
    contextMenu: [],
  };
  if (details.kind === 'application' && target.kind === 'application') {
    return {
      ...common,
      type: APPLICATION_TEASER_FEED_ITEM_SELECTOR,
      appId: target.id,
      appSlug: target.slug,
      appName: item.title,
      appLink: link(target),
      description: details.description,
      avatarUrl: details.logoUrl ?? '',
      coverImage: details.bannerUrl
        ? { url: details.bannerUrl, alt: item.title }
        : null,
      category: details.category
        ? {
            ...details.category,
            link: link({ kind: 'category', slug: details.category.slug }),
          }
        : null,
      tags: details.tags.map((tag) => ({
        ...tag,
        link: link({ kind: 'tag', slug: tag.slug }),
      })),
      aggregatedScore: details.reviews?.rating ?? null,
      reviewsCount: details.reviews?.total ?? null,
      reviewsLink: link({
        kind: 'application-reviews',
        applicationSlug: target.slug,
      }),
    };
  }
  if (details.kind === 'article' && target.kind === 'article') {
    return {
      ...common,
      type: ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
      articleLink: link(target),
      author: details.byline,
      publicationDate: details.publishedAt,
      excerpt: details.excerpt,
      category: details.category,
      tags: details.tags.map((tag) => ({
        ...tag,
        link: link({ kind: 'tag', slug: tag.slug }),
      })),
      coverImage: null,
      publishedCover: details.cover ?? undefined,
      localVoting: false,
      upvotesCount: null,
      commentsCount: null,
    };
  }
  if (details.kind === 'suite' && target.kind === 'suite') {
    return {
      ...common,
      type: SUITE_TEASER_FEED_ITEM_SELECTOR,
      suiteLink: link(target),
      suiteTitle: item.title,
      suiteDescription: details.description,
      category: 'Category unavailable',
      applicationCount: details.applicationCount,
      apps: details.applications.map((app) => ({
        name: app.name,
        description: app.description,
        logo: app.logoUrl ?? '',
      })),
    };
  }
  if (details.kind === 'review' && target.kind === 'review') {
    return {
      ...common,
      type: APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
      appId: target.applicationId,
      appSlug: target.applicationSlug,
      appName: details.applicationName,
      appLink: link(target),
      reviewLink: link(target),
      avatarUrl: details.logoUrl ?? '',
      reviewerName: details.byline,
      reviewerRole: '',
      reviewerBadges: [],
      testimonial: details.text,
      rating: details.rating,
      reviewDate: new Date(details.publishedAt),
      helpfulCount: item.engagement,
      localVoting: false,
    };
  }
  if (details.kind === 'release' && target.kind === 'release') {
    return {
      ...common,
      type: APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
      subtitle: `${details.releaseType} / ${details.channel}`,
      appSlug: target.applicationSlug,
      appName: details.applicationName,
      appLink: link(target),
      avatarUrl: details.logoUrl ?? '',
      version: target.version,
      description: details.description,
      releaseDate: new Date(details.releasedOn),
      releasedOn: details.releasedOn,
      changes: details.changes,
      changeCount: details.changeCount,
      commentsNumber: null,
      localVoting: false,
    };
  }
  if (details.kind === 'discussion' && target.kind === 'discussion') {
    return {
      ...common,
      type: DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
      topicLink: link(target),
      appSlug: target.applicationSlug,
      discussionSlug: target.id,
      discussionData: {
        topic: item.title,
        messages: details.posts.map((post) => ({
          id: post.id,
          author: post.byline,
          content: post.text,
          timestamp: post.publishedAt,
        })),
      },
      participantsCount: null,
      viewsCount: null,
      replyCount: details.replyCount,
    };
  }
  return null;
}
