import { parseCatalogApp, type CatalogApp } from '@domains/catalog/record';
import {
  parseArticlePreview,
  type ArticlePreview,
  type ArticlePage,
} from '@domains/publication/article';
import {
  exploreObject,
  parseExplorePage,
  ExploreInputError,
  type ExploreItem,
} from './explore';
import { selectExplorePage, type ExploreSelection } from './explore-selection';
import { classificationFields } from '@domains/publication/classification';

export interface DigestGroup<T> {
  items: T[];
  more: boolean;
}
export interface DigestContent {
  latest: DigestGroup<ExploreItem>;
  articles: DigestGroup<ArticlePreview>;
  applications: DigestGroup<CatalogApp>;
  discussions: DigestGroup<ExploreItem>;
}
export type DigestSelection = {
  [K in keyof DigestContent]: DigestContent[K] & { hidden: number };
};
export interface DigestArticles {
  read(): Promise<ArticlePage>;
}

function group<T extends { id: string }>(
  input: unknown,
  max: number,
  parse: (item: unknown) => T
): DigestGroup<T> {
  const value = exploreObject(input, ['items', 'more']);
  if (
    !Array.isArray(value['items']) ||
    value['items'].length > max ||
    typeof value['more'] !== 'boolean'
  )
    throw new ExploreInputError('Invalid Digest selection');
  const items = value['items'].map(parse);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new ExploreInputError('Duplicate Digest item');
  return { items, more: value['more'] };
}
function activity(
  input: unknown,
  discussionOnly = false
): DigestGroup<ExploreItem> {
  const value = exploreObject(input, ['items', 'more']);
  const page = parseExplorePage({ items: value['items'], after: null });
  if (
    typeof value['more'] !== 'boolean' ||
    (discussionOnly && page.items.some((item) => item.kind !== 'discussion'))
  )
    throw new ExploreInputError('Invalid Digest activity');
  return { items: page.items, more: value['more'] };
}
export function parseDigest(input: unknown): DigestContent {
  const value = exploreObject(input, [
    'latest',
    'articles',
    'applications',
    'discussions',
  ]);
  return {
    latest: activity(value['latest']),
    articles: group(value['articles'], 20, parseArticlePreview),
    applications: group(value['applications'], 10, parseCatalogApp),
    discussions: activity(value['discussions'], true),
  };
}

/** Preferences select within bounded source pages; they never grant content visibility. */
export function selectDigest(
  content: DigestContent,
  choices: ExploreSelection
): DigestSelection {
  function selected<T extends { id: string }>(
    source: DigestGroup<T>,
    previews: ExploreItem[],
    size: number
  ): DigestGroup<T> & { hidden: number } {
    const byId = new Map(
      source.items.map((item, index) => [
        `${previews[index].kind}:${item.id}`,
        item,
      ])
    );
    const ordered = selectExplorePage(previews, choices);
    return {
      items: ordered
        .slice(0, size)
        .map((item) => byId.get(`${item.kind}:${item.id}`)!),
      more: source.more || ordered.length > size,
      hidden: previews.length - ordered.length,
    };
  }
  function selectedActivity(source: DigestGroup<ExploreItem>, size: number) {
    const items = selectExplorePage(source.items, choices);
    return {
      items: items.slice(0, size),
      more: source.more || items.length > size,
      hidden: source.items.length - items.length,
    };
  }
  return {
    latest: selectedActivity(content.latest, 3),
    discussions: selectedActivity(content.discussions, 1),
    applications: selected(
      content.applications,
      content.applications.items.map((app) => ({
        kind: 'application',
        id: app.id,
        title: app.name,
        at: Date.parse(app.createdAt),
        target: { kind: 'application', id: app.id, slug: app.slug },
        categories: app.categories.flatMap((value) => [value.id, value.slug]),
        tags: app.tags.flatMap((value) => [value.id, value.slug]),
        engagement: null,
        ...classificationFields(app.classification),
      })),
      2
    ),
    articles: selected(
      content.articles,
      content.articles.items.map((article) => ({
        kind: 'article',
        id: article.id,
        title: article.title,
        at: article.publishedAt,
        target: { kind: 'article', id: article.id, slug: article.slug },
        categories: [article.category],
        tags: article.tags,
        engagement: null,
        ...classificationFields(article.classification),
      })),
      2
    ),
  };
}
