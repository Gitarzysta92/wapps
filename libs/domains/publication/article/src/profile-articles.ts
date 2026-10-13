import {
  ARTICLE_LIMITS,
  ArticleInputError,
  articleId,
  articleObject,
  articleSlug,
  articleTimestamp,
} from './article-workspace';

export const PROFILE_ARTICLES_PAGE_SIZE = 20;
export interface ProfileArticleSummary {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  publishedAt: number;
}
export interface ProfileArticlesPage {
  sharing: 'visible' | 'hidden';
  items: ProfileArticleSummary[];
  after: string | null;
}

export function profileArticlesCursor(value: unknown): string | null {
  return value === null ? null : articleId(value);
}

export function parseProfileArticleSummary(
  input: unknown
): ProfileArticleSummary {
  const row = articleObject(input, [
    'id',
    'title',
    'excerpt',
    'slug',
    'publishedAt',
  ]);
  const title = row['title'],
    excerpt = row['excerpt'];
  if (
    typeof title !== 'string' ||
    !title ||
    title !== title.trim() ||
    title.length > ARTICLE_LIMITS.title ||
    typeof excerpt !== 'string' ||
    excerpt !== excerpt.trim() ||
    excerpt.length > ARTICLE_LIMITS.excerpt ||
    [...(title + excerpt)].some(
      (character) =>
        character.charCodeAt(0) === 127 ||
        ((character.codePointAt(0) ?? 0) >= 0xd800 &&
          (character.codePointAt(0) ?? 0) <= 0xdfff) ||
        (character.charCodeAt(0) < 32 &&
          ![9, 10, 13].includes(character.charCodeAt(0)))
    )
  )
    throw new ArticleInputError('Invalid profile article metadata');
  return {
    id: articleId(row['id']),
    title,
    excerpt,
    slug: articleSlug(row['slug']),
    publishedAt: articleTimestamp(row['publishedAt']),
  };
}

export function parseProfileArticlesPage(input: unknown): ProfileArticlesPage {
  const row = articleObject(input, ['sharing', 'items', 'after']);
  if (
    (row['sharing'] !== 'visible' && row['sharing'] !== 'hidden') ||
    !Array.isArray(row['items']) ||
    row['items'].length > PROFILE_ARTICLES_PAGE_SIZE
  )
    throw new ArticleInputError('Invalid profile articles page');
  const items = row['items'].map(parseProfileArticleSummary);
  const after = profileArticlesCursor(row['after']);
  if (
    (row['sharing'] === 'hidden' && (items.length || after !== null)) ||
    items.some((item, index) => index > 0 && items[index - 1].id >= item.id) ||
    (after !== null &&
      (items.length !== PROFILE_ARTICLES_PAGE_SIZE ||
        after !== items[items.length - 1].id))
  )
    throw new ArticleInputError('Invalid profile articles continuation');
  return { sharing: row['sharing'], items, after };
}

export function parseProfileArticlesQuery(input: unknown): {
  after: string | null;
} {
  const query = articleObject(input, ['after']);
  if (query['after'] !== undefined && typeof query['after'] !== 'string')
    throw new ArticleInputError('Invalid article cursor');
  return {
    after:
      query['after'] === undefined
        ? null
        : profileArticlesCursor(query['after']),
  };
}

export function profileArticlesPage(
  input: ProfileArticleSummary[],
  cursor: string | null
): ProfileArticlesPage {
  const after = profileArticlesCursor(cursor);
  if (input.length > PROFILE_ARTICLES_PAGE_SIZE + 1)
    throw new ArticleInputError('Profile article page exceeds capacity');
  const selected = input.map(parseProfileArticleSummary);
  if (
    selected.some(
      (item, index) =>
        (after !== null && item.id <= after) ||
        (index > 0 && selected[index - 1].id >= item.id)
    )
  )
    throw new ArticleInputError('Invalid profile article order');
  const items = selected.slice(0, PROFILE_ARTICLES_PAGE_SIZE);
  return parseProfileArticlesPage({
    sharing: 'visible',
    items,
    after: selected.length > items.length ? items[items.length - 1].id : null,
  });
}
