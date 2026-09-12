import { APPLICATIONS, DISCUSSIONS, FEED_ITEM_EXAMPLES } from '@portals/shared/data';
import { CATALOG_ENTRIES, CatalogEntry } from '@portals/shared/features/listing';

type PortalFeedItem = (typeof FEED_ITEM_EXAMPLES)[number];

export interface DigestActivity {
  id: string;
  kind: string;
  icon: string;
  title: string;
  summary: string;
  timestamp: Date;
  link: string;
  context?: string;
}

const newestFirst = (a: { timestamp: Date }, b: { timestamp: Date }) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

/** A bounded overview of the same activity as Explore, with articles from the portal catalog. */
export function buildDigestContent(
  feed: readonly PortalFeedItem[] = FEED_ITEM_EXAMPLES,
  catalog: readonly CatalogEntry[] = CATALOG_ENTRIES,
) {
  const ordered = [...feed].sort(newestFirst);
  const activity = ordered.flatMap(item => {
    const entry = toActivity(item, catalog);
    return entry ? [entry] : [];
  });
  const appSlugs = new Set(ordered.flatMap(item => 'appSlug' in item ? [item.appSlug] : []));
  const applications = [...appSlugs].flatMap(slug => {
    const app = catalog.find(entry => entry.kind === 'applications' && entry.slug === slug);
    return app ? [app] : [];
  }).slice(0, 2);
  const articles = catalog.filter(entry => entry.kind === 'articles')
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0) || a.slug.localeCompare(b.slug))
    .slice(0, 2);
  // Discussion teasers in the feed can refer to a different app; use the thread's actual owner.
  const discussions: DigestActivity[] = [...DISCUSSIONS]
    .sort((a, b) => new Date(b.publishedTime).getTime() - new Date(a.publishedTime).getTime())
    .flatMap(thread => {
      const app = APPLICATIONS.find(app => app.id === thread.associationId);
      if (!app || !catalog.some(entry => entry.kind === 'applications' && entry.slug === app.slug)) return [];
      return [{ id: thread.id, kind: 'Discussion', icon: '@tui.messages-square',
        title: thread.title, summary: thread.content, timestamp: new Date(thread.publishedTime),
        context: `${thread.replies.length} replies · ${thread.viewsCount} views`,
        link: `/apps/${app.slug}/discussions/${thread.slug}` }];
    }).slice(0, 1);
  return {
    latest: activity.slice(0, 3),
    articles,
    applications,
    discussions,
  };
}

function toActivity(item: PortalFeedItem, catalog: readonly CatalogEntry[]): DigestActivity | undefined {
  const base = { id: item.id, timestamp: new Date(item.timestamp), summary: item.subtitle ?? '' };
  if ('discussionSlug' in item) {
    return undefined;
  }
  if ('reviewerName' in item) {
    return { ...base, kind: 'Review', icon: '@tui.star', title: `${item.appName} review`,
      summary: item.testimonial, context: `${item.reviewerName} · ${item.rating.toFixed(1)} / 5`,
      link: `/apps/${item.appSlug}/reviews` };
  }
  if ('version' in item) {
    return { ...base, kind: 'Release', icon: '@tui.git-commit-horizontal',
      title: `${item.appName} ${item.version}`, link: `/apps/${item.appSlug}/devlog/${item.version}` };
  }
  if ('overallStatus' in item) {
    return { ...base, kind: 'Service update', icon: '@tui.heart-pulse',
      title: item.title, summary: item.statusMessage, link: `/apps/${item.appSlug}/health` };
  }
  if ('appName' in item) {
    return { ...base, kind: 'Application', icon: '@tui.box', title: item.appName,
      link: `/apps/${item.appSlug}` };
  }
  if ('author' in item) {
    const article = catalog.find(entry => entry.kind === 'articles' && entry.name === item.title);
    if (article) return { ...base, kind: 'Article', icon: '@tui.newspaper', title: item.title, link: `/articles/${article.slug}` };
  }
  return undefined;
}
