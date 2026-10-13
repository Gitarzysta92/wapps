import { catalogSlug } from '@domains/catalog/record';
import {
  exploreId,
  exploreObject,
  parseExplorePage,
  ExploreInputError,
  type ExploreItem,
  type ExplorePage,
} from './explore';

export interface TimelineApplication {
  id: string;
  slug: string;
  name: string;
}
export interface TimelinePage extends ExplorePage {
  application: TimelineApplication;
}
export class TimelineMissingError extends Error {}

/** Suite membership is confirmed by its owning service before this public DTO is returned. */
export function isApplicationActivity(
  item: ExploreItem,
  applicationId: string
) {
  return (
    item.kind === 'suite' ||
    (item.kind === 'application' && item.id === applicationId) ||
    ('applicationId' in item.target &&
      item.target.applicationId === applicationId)
  );
}
export function parseTimelinePage(input: unknown): TimelinePage {
  const value = exploreObject(input, ['application', 'items', 'after']);
  const app = exploreObject(value['application'], ['id', 'slug', 'name']);
  const id = exploreId(app['id']),
    slug = catalogSlug(app['slug']);
  if (
    typeof app['name'] !== 'string' ||
    !app['name'].trim() ||
    app['name'].length > 200
  )
    throw new ExploreInputError('Invalid timeline application');
  const page = parseExplorePage({
    items: value['items'],
    after: value['after'],
  });
  if (page.items.some((item) => !isApplicationActivity(item, id)))
    throw new ExploreInputError('Unexpected application activity');
  return { ...page, application: { id, slug, name: app['name'] } };
}
