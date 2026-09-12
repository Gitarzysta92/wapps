import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { IFeedProviderPort, IFeedPage, IFeedItem } from '@portals/shared/features/feed';
import { APPLICATIONS, DISCUSSIONS, FEED_ITEM_EXAMPLES } from '@portals/shared/data';
import { Result } from '@foundation/standard';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { NAVIGATION } from '../../navigation';

type TimelineItem = IFeedItem & {
  appSlug?: string; discussionSlug?: string; appLink?: string; topicLink?: string; reviewsLink?: string;
  category?: { slug: string; link?: string }; tags?: { slug: string; link?: string }[];
};

/** Build an isolated, stable snapshot. Never mutate shared fixtures. */
export function applicationTimelineItems(slug: string): TimelineItem[] {
  if (!APPLICATIONS.some(app => app.slug === slug)) return [];
  const path = (route: string, params: Record<string, string>) => buildRoutePath('/' + route.replace(/^\/+/, ''), params);
  return (FEED_ITEM_EXAMPLES as TimelineItem[])
    .filter(item => item.appSlug === slug)
    .filter(item => !item.discussionSlug || DISCUSSIONS.some(d => d.slug === item.discussionSlug && d.associationId === APPLICATIONS.find(a => a.slug === slug)?.id))
    .map(original => {
      const item = structuredClone(original);
      const appRoute = item.type === 'application-health-feed-item' ? NAVIGATION.applicationHealth.path
        : item.type === 'application-review-feed-item' ? NAVIGATION.applicationReviews.path
        : item.type === 'application-dev-log-feed-item' ? NAVIGATION.applicationDevLog.path
        : NAVIGATION.application.path;
      item.appLink = path(appRoute, { appSlug: slug });
      item.reviewsLink = path(NAVIGATION.applicationReviews.path, { appSlug: slug });
      if (item.discussionSlug) item.topicLink = path(NAVIGATION.applicationDiscussion.path, { appSlug: slug, discussionSlug: item.discussionSlug });
      if (item.category) item.category.link = path(NAVIGATION.category.path, { categorySlug: item.category.slug });
      item.tags?.forEach(tag => tag.link = path(NAVIGATION.tag.path, { tagSlug: tag.slug }));
      return item;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() || a.id.localeCompare(b.id));
}

@Injectable()
export class ApplicationTimelineFeedProviderService implements IFeedProviderPort {
  private items: TimelineItem[] = [];
  setApplication(slug: string): void { this.items = applicationTimelineItems(slug); }
  getFeedPage(page: number, size: number) {
    if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size <= 0) {
      return of<Result<IFeedPage, Error>>({ ok: false, error: new Error('Invalid page') });
    }
    const end = (page + 1) * size;
    const hasMore = end < this.items.length;
    return of<Result<IFeedPage, Error>>({ ok: true, value: {
      items: structuredClone(this.items.slice(page * size, end)), hasMore,
      nextPage: hasMore ? page + 1 : undefined
    } });
  }
}
