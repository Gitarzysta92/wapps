import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
export const ARTICLE_LIMITS = {
  drafts: 100,
  title: 160,
  slug: 100,
  excerpt: 1000,
  byline: 100,
  category: 80,
  tags: 12,
  sections: 30,
  paragraphs: 16,
  paragraph: 4000,
  serializedContent: 24_000,
  pageSize: 20,
  selection: 50,
} as const;

export const ARTICLE_ANONYMOUS_BYLINE = 'Deleted account';

export function anonymizeArticleFields(input: ArticleFields): ArticleFields {
  return parseArticleFields({ ...input, byline: ARTICLE_ANONYMOUS_BYLINE });
}

export interface ArticleFields extends ClassifiedContent {
  title: string;
  slug: string;
  excerpt: string;
  /** Deliberately supplied public attribution, reviewed with the content. */
  byline: string;
  category: string;
  tags: string[];
  sections: { heading: string; paragraphs: string[] }[];
  cover?: { imageId: string; alt: string };
}
export interface ArticleDraft extends ArticleFields {
  id: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
}
export interface ArticleReceipt {
  id: string;
  revision: number;
  deleted: boolean;
}
export type ArticlePublicationAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'withdraw';
export interface ArticleSubmission extends ArticleFields {
  submittedRevision: number;
  sourcePublicationRevision: number | null;
  submittedAt: number;
  reviewedAt: number | null;
  status: 'submitted' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
}
export interface ArticlePublicationStatus {
  id: string;
  revision: number;
  publicationRevision: number | null;
  publishedSubmissionRevision: number | null;
  publicSlug: string | null;
  visible: boolean;
  latestSubmission: ArticleSubmission | null;
}
export interface ArticlePublicationInput {
  expectedRevision: number;
  expectedPublicationRevision: number | null;
  submittedRevision: number | null;
  reason: string;
}
export interface ArticlePublicationReceipt {
  id: string;
  revision: number;
  action: ArticlePublicationAction;
  submittedRevision: number | null;
  publicationRevision: number | null;
}
export interface PublishedArticle extends ArticleFields {
  id: string;
  revision: number;
  submittedRevision: number;
  publishedAt: number;
  updatedAt: number;
}
export type ArticlePreview = Omit<PublishedArticle, 'sections'>;
export interface ArticlePage {
  items: ArticlePreview[];
  page: number;
  total: number;
  pageSize?: number;
}
export interface ArticleReviewPage {
  items: ArticlePublicationStatus[];
  page: number;
  total: number;
}
export interface ArticleBrowseQuery {
  q: string;
  category: string;
  tag: string;
  /** Every selected tag must occur in the approved publication. */
  tags?: string[];
  page: number;
  pageSize?: number;
  sort?: 'name' | 'name-desc' | 'newest';
}
export class ArticleInputError extends Error {}
export class ArticleConflictError extends Error {}
export class ArticleNotFoundError extends Error {}
export class ArticleUnavailableError extends Error {}

export function articleObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new ArticleInputError('Unexpected article fields');
  return Object.fromEntries(Object.entries(input));
}
export function articleId(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input
    )
  )
    throw new ArticleInputError('Invalid article ID');
  return input;
}
export function articleRevision(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1)
    throw new ArticleInputError('A positive article revision is required');
  return input;
}
export function articleTimestamp(input: unknown): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < 0 ||
    input > 8_640_000_000_000_000
  )
    throw new ArticleInputError('Invalid article timestamp');
  return input;
}
function optionalRevision(input: unknown) {
  return input === null ? null : articleRevision(input);
}
function text(input: unknown, min: number, max: number, label: string): string {
  if (
    typeof input !== 'string' ||
    input.length > max ||
    input.trim().length < min ||
    [...input].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        code === 127 ||
        (code < 32 && ![9, 10, 13].includes(code)) ||
        (code >= 0xd800 && code <= 0xdfff)
      );
    })
  )
    throw new ArticleInputError(
      `${label} must contain ${min}-${max} characters of plain text`
    );
  return input.trim();
}
export function articleSlug(input: unknown): string {
  if (
    typeof input !== 'string' ||
    input.length > ARTICLE_LIMITS.slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input) ||
    ['create', 'new', 'page'].includes(input)
  )
    throw new ArticleInputError(
      'Use an article slug of 1-100 lowercase letters, digits and hyphens'
    );
  return input;
}
function tag(input: unknown): string {
  if (
    typeof input !== 'string' ||
    input.length > 40 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input)
  )
    throw new ArticleInputError(
      'Use tags of 1-40 lowercase letters, digits and hyphens'
    );
  return input;
}
export const ARTICLE_FIELD_KEYS = [
  'title',
  'slug',
  'excerpt',
  'byline',
  'category',
  'tags',
  'sections',
  'cover',
  'classification',
] as const;
export function parseArticleCoverReference(
  input: unknown
): NonNullable<ArticleFields['cover']> {
  const value = articleObject(input, ['imageId', 'alt']);
  return {
    imageId: articleId(value['imageId']),
    alt: text(value['alt'], 1, 300, 'Cover description'),
  };
}
function metadata(
  value: Record<string, unknown>
): Omit<ArticleFields, 'sections'> {
  if (
    !Array.isArray(value['tags']) ||
    value['tags'].length > ARTICLE_LIMITS.tags
  )
    throw new ArticleInputError('Use at most 12 article tags');
  const tags = value['tags'].map(tag);
  if (new Set(tags).size !== tags.length)
    throw new ArticleInputError('Article tags must be unique');
  return {
    title: text(value['title'], 1, ARTICLE_LIMITS.title, 'Title'),
    slug: articleSlug(value['slug']),
    excerpt: text(value['excerpt'], 1, ARTICLE_LIMITS.excerpt, 'Summary'),
    byline: text(value['byline'], 1, ARTICLE_LIMITS.byline, 'Public byline'),
    category: text(value['category'], 1, ARTICLE_LIMITS.category, 'Category'),
    tags,
    ...classificationFields(value['classification'], ArticleInputError),
    // Omit absent covers to preserve hashes of existing text-only snapshots.
    ...(value['cover'] === undefined
      ? {}
      : { cover: parseArticleCoverReference(value['cover']) }),
  };
}
export function parseArticleFields(input: unknown): ArticleFields {
  const value = articleObject(input, ARTICLE_FIELD_KEYS);
  if (
    !Array.isArray(value['sections']) ||
    value['sections'].length < 1 ||
    value['sections'].length > ARTICLE_LIMITS.sections
  )
    throw new ArticleInputError('An article needs 1-30 sections');
  const fields: ArticleFields = {
    ...metadata(value),
    sections: value['sections'].map((input) => {
      const section = articleObject(input, ['heading', 'paragraphs']);
      if (
        !Array.isArray(section['paragraphs']) ||
        section['paragraphs'].length < 1 ||
        section['paragraphs'].length > ARTICLE_LIMITS.paragraphs
      )
        throw new ArticleInputError(
          'Each article section needs 1-16 paragraphs'
        );
      return {
        heading: text(section['heading'], 0, 160, 'Section heading'),
        paragraphs: section['paragraphs'].map((value) =>
          text(value, 1, ARTICLE_LIMITS.paragraph, 'Paragraph')
        ),
      };
    }),
  };
  // Reserve enough space to replace even a one-character byline without truncating retained text.
  const limit =
    ARTICLE_LIMITS.serializedContent +
    (fields.byline === ARTICLE_ANONYMOUS_BYLINE
      ? ARTICLE_ANONYMOUS_BYLINE.length - 1
      : 0);
  if (JSON.stringify(fields).length > limit)
    throw new ArticleInputError(
      'The complete article exceeds the content limit'
    );
  return fields;
}
export function articleFieldsFrom(
  value: Record<string, unknown>
): ArticleFields {
  return parseArticleFields(
    Object.fromEntries(ARTICLE_FIELD_KEYS.map((key) => [key, value[key]]))
  );
}
export function parseArticleDraft(input: unknown): ArticleDraft {
  const value = articleObject(input, [
    ...ARTICLE_FIELD_KEYS,
    'id',
    'revision',
    'createdAt',
    'updatedAt',
  ]);
  const createdAt = articleTimestamp(value['createdAt']),
    updatedAt = articleTimestamp(value['updatedAt']);
  if (updatedAt < createdAt)
    throw new ArticleInputError('Invalid article draft timestamps');
  return {
    ...articleFieldsFrom(value),
    id: articleId(value['id']),
    revision: articleRevision(value['revision']),
    createdAt,
    updatedAt,
  };
}
export function parseArticleReceipt(input: unknown): ArticleReceipt {
  const value = articleObject(input, ['id', 'revision', 'deleted']);
  if (typeof value['deleted'] !== 'boolean')
    throw new ArticleInputError('Invalid article receipt');
  return {
    id: articleId(value['id']),
    revision: articleRevision(value['revision']),
    deleted: value['deleted'],
  };
}
export function parseArticleSubmission(input: unknown): ArticleSubmission {
  const value = articleObject(input, [
    ...ARTICLE_FIELD_KEYS,
    'submittedRevision',
    'sourcePublicationRevision',
    'submittedAt',
    'reviewedAt',
    'status',
    'reason',
  ]);
  const status = value['status'];
  if (
    status !== 'submitted' &&
    status !== 'approved' &&
    status !== 'rejected' &&
    status !== 'cancelled'
  )
    throw new ArticleInputError('Invalid article review status');
  const submittedAt = articleTimestamp(value['submittedAt']);
  const reviewedAt =
    value['reviewedAt'] === null ? null : articleTimestamp(value['reviewedAt']);
  const reason = text(
    value['reason'],
    status === 'rejected' ? 1 : 0,
    1000,
    'Review reason'
  );
  if (
    (status === 'submitted') !== (reviewedAt === null) ||
    (reviewedAt !== null && reviewedAt < submittedAt) ||
    ((status === 'submitted' || status === 'cancelled') && reason !== '')
  )
    throw new ArticleInputError('Inconsistent article review');
  return {
    ...articleFieldsFrom(value),
    submittedRevision: articleRevision(value['submittedRevision']),
    sourcePublicationRevision: optionalRevision(
      value['sourcePublicationRevision']
    ),
    status,
    submittedAt,
    reviewedAt,
    reason,
  };
}
export function parseArticlePublicationStatus(
  input: unknown
): ArticlePublicationStatus {
  const value = articleObject(input, [
    'id',
    'revision',
    'publicationRevision',
    'publishedSubmissionRevision',
    'publicSlug',
    'visible',
    'latestSubmission',
  ]);
  const revision = articleRevision(value['revision']);
  const publicationRevision = optionalRevision(value['publicationRevision']);
  const publishedSubmissionRevision = optionalRevision(
    value['publishedSubmissionRevision']
  );
  const publicSlug =
    value['publicSlug'] === null ? null : articleSlug(value['publicSlug']);
  const latestSubmission =
    value['latestSubmission'] === null
      ? null
      : parseArticleSubmission(value['latestSubmission']);
  if (
    typeof value['visible'] !== 'boolean' ||
    (publicationRevision === null) !== (publicSlug === null) ||
    (publicationRevision === null) !== (publishedSubmissionRevision === null) ||
    (value['visible'] && publicationRevision === null) ||
    (publishedSubmissionRevision !== null &&
      publishedSubmissionRevision >= revision) ||
    (latestSubmission &&
      (latestSubmission.submittedRevision >= revision ||
        (latestSubmission.sourcePublicationRevision !== null &&
          (publicationRevision === null ||
            latestSubmission.sourcePublicationRevision > publicationRevision))))
  )
    throw new ArticleInputError('Inconsistent article publication state');
  return {
    id: articleId(value['id']),
    revision,
    publicationRevision,
    publishedSubmissionRevision,
    publicSlug,
    visible: value['visible'],
    latestSubmission,
  };
}
function publicationAction(input: unknown): ArticlePublicationAction {
  if (
    input !== 'submit' &&
    input !== 'approve' &&
    input !== 'reject' &&
    input !== 'withdraw'
  )
    throw new ArticleInputError('Invalid article publication action');
  return input;
}
export function parseArticlePublicationInput(
  action: ArticlePublicationAction,
  input: unknown
): ArticlePublicationInput {
  publicationAction(action);
  const review = action === 'approve' || action === 'reject';
  const value = articleObject(input, [
    'expectedRevision',
    'expectedPublicationRevision',
    ...(review ? ['submittedRevision', 'reason'] : []),
  ]);
  return {
    expectedRevision: articleRevision(value['expectedRevision']),
    expectedPublicationRevision: optionalRevision(
      value['expectedPublicationRevision']
    ),
    submittedRevision: review
      ? articleRevision(value['submittedRevision'])
      : null,
    reason: review
      ? text(
          value['reason'] ?? '',
          action === 'reject' ? 1 : 0,
          1000,
          'Review reason'
        )
      : '',
  };
}
export function assertArticleSlug(
  fields: ArticleFields,
  publicSlug: string | null
) {
  if (publicSlug !== null && fields.slug !== publicSlug)
    throw new ArticleConflictError('A published article URL cannot be renamed');
}
export function assertArticlePublicationTransition(
  action: ArticlePublicationAction,
  status: ArticlePublicationStatus,
  input: ArticlePublicationInput
) {
  publicationAction(action);
  if (
    status.revision !== input.expectedRevision ||
    status.publicationRevision !== input.expectedPublicationRevision
  )
    throw new ArticleConflictError(
      'The article changed. Reload before continuing.'
    );
  if (
    !Number.isSafeInteger(status.revision + 1) ||
    ((action === 'approve' || action === 'withdraw') &&
      !Number.isSafeInteger((status.publicationRevision ?? 0) + 1))
  )
    throw new ArticleConflictError('Article revision limit reached');
  const pending = status.latestSubmission?.status === 'submitted';
  if (action === 'submit' && pending)
    throw new ArticleConflictError(
      'An article submission is already awaiting review'
    );
  if (
    (action === 'approve' || action === 'reject') &&
    (!pending ||
      status.latestSubmission?.submittedRevision !== input.submittedRevision)
  )
    throw new ArticleConflictError(
      'This article submission is no longer awaiting review'
    );
  if (
    action === 'approve' &&
    status.latestSubmission?.sourcePublicationRevision !==
      status.publicationRevision
  )
    throw new ArticleConflictError(
      'Public content changed. Submit a new revision for review.'
    );
  if (action === 'withdraw' && !status.visible && !pending)
    throw new ArticleConflictError(
      'There is no public or pending article to withdraw'
    );
}
export function assertArticleDeletion(status: ArticlePublicationStatus) {
  if (status.visible || status.latestSubmission?.status === 'submitted')
    throw new ArticleConflictError(
      'Withdraw the public or pending article before deleting its draft'
    );
}
export function parseArticlePublicationReceipt(
  input: unknown
): ArticlePublicationReceipt {
  const value = articleObject(input, [
    'id',
    'revision',
    'action',
    'submittedRevision',
    'publicationRevision',
  ]);
  const action = publicationAction(value['action']);
  const revision = articleRevision(value['revision']);
  const submittedRevision = optionalRevision(value['submittedRevision']);
  const publicationRevision = optionalRevision(value['publicationRevision']);
  if (
    (action !== 'withdraw' && submittedRevision === null) ||
    (submittedRevision !== null && submittedRevision >= revision) ||
    (action === 'submit' && submittedRevision !== revision - 1) ||
    (action === 'approve' && publicationRevision === null)
  )
    throw new ArticleInputError('Inconsistent article publication receipt');
  return {
    id: articleId(value['id']),
    revision,
    action,
    submittedRevision,
    publicationRevision,
  };
}
const publicKeys = [
  'id',
  'revision',
  'submittedRevision',
  'publishedAt',
  'updatedAt',
] as const;
function publicMetadata(
  value: Record<string, unknown>
): Omit<PublishedArticle, keyof ArticleFields> {
  const publishedAt = articleTimestamp(value['publishedAt']),
    updatedAt = articleTimestamp(value['updatedAt']);
  if (updatedAt < publishedAt)
    throw new ArticleInputError('Invalid article publication timestamps');
  return {
    id: articleId(value['id']),
    revision: articleRevision(value['revision']),
    submittedRevision: articleRevision(value['submittedRevision']),
    publishedAt,
    updatedAt,
  };
}
export function parsePublishedArticle(input: unknown): PublishedArticle {
  const value = articleObject(input, [...ARTICLE_FIELD_KEYS, ...publicKeys]);
  return { ...articleFieldsFrom(value), ...publicMetadata(value) };
}
export function articlePreview(input: PublishedArticle): ArticlePreview {
  const value = { ...parsePublishedArticle(input) };
  return { ...metadata(value), ...publicMetadata(value) };
}
export function parseArticlePreview(input: unknown): ArticlePreview {
  const value = articleObject(input, [
    ...ARTICLE_FIELD_KEYS.filter((key) => key !== 'sections'),
    ...publicKeys,
  ]);
  return { ...metadata(value), ...publicMetadata(value) };
}
export function articlePageNumber(input: unknown): number {
  if (input === undefined) return 1;
  if (
    typeof input !== 'string' ||
    !/^[1-9][0-9]{0,4}$/.test(input) ||
    Number(input) > 10000
  )
    throw new ArticleInputError('Invalid article page');
  return Number(input);
}
export function parseArticleBrowseQuery(input: unknown): ArticleBrowseQuery {
  const value = articleObject(input, [
    'q',
    'category',
    'tag',
    'tags',
    'page',
    'pageSize',
    'sort',
  ]);
  const pageSize =
    value['pageSize'] === undefined
      ? undefined
      : articlePageNumber(value['pageSize']);
  const sort = value['sort'];
  if (
    (pageSize !== undefined && pageSize > 100) ||
    (sort !== undefined &&
      sort !== 'name' &&
      sort !== 'name-desc' &&
      sort !== 'newest')
  )
    throw new ArticleInputError('Invalid article page size or sort');
  const selectedTag =
    value['tag'] === undefined || value['tag'] === '' ? '' : tag(value['tag']);
  const selectedTags = value['tags'];
  let tags: string[] | undefined;
  if (selectedTags !== undefined) {
    const entries =
      selectedTags === ''
        ? []
        : typeof selectedTags === 'string'
        ? selectedTags.split(',')
        : selectedTags;
    if (!Array.isArray(entries) || entries.length > ARTICLE_LIMITS.tags)
      throw new ArticleInputError('Use at most 12 article tag filters');
    tags = [...new Set(entries.map(tag))].sort();
    if (
      new Set([...tags, ...(selectedTag ? [selectedTag] : [])]).size >
      ARTICLE_LIMITS.tags
    )
      throw new ArticleInputError('Use at most 12 article tag filters');
  }
  return {
    q: text(value['q'] ?? '', 0, 100, 'Search'),
    category: text(
      value['category'] ?? '',
      0,
      ARTICLE_LIMITS.category,
      'Category'
    ),
    tag: selectedTag,
    ...(tags === undefined ? {} : { tags }),
    page: articlePageNumber(value['page']),
    ...(pageSize === undefined ? {} : { pageSize }),
    ...(sort === undefined ? {} : { sort }),
  };
}

export function articleBrowseTags(query: ArticleBrowseQuery): string[] {
  return [
    ...new Set([...(query.tag ? [query.tag] : []), ...(query.tags ?? [])]),
  ].sort();
}

export function articleBrowseParameters(
  query: ArticleBrowseQuery
): Record<string, string> {
  return {
    q: query.q,
    category: query.category,
    tag: query.tag,
    ...(query.tags === undefined ? {} : { tags: query.tags.join(',') }),
    page: String(query.page),
    ...(query.pageSize === undefined
      ? {}
      : { pageSize: String(query.pageSize) }),
    ...(query.sort === undefined ? {} : { sort: query.sort }),
  };
}
function page<T extends { id: string }>(
  input: unknown,
  parse: (item: unknown) => T,
  flexible = false
) {
  const value = articleObject(input, [
    'items',
    'page',
    'total',
    ...(flexible ? ['pageSize'] : []),
  ]);
  const number = articleRevision(value['page']),
    total = value['total'];
  const pageSize =
    value['pageSize'] === undefined
      ? ARTICLE_LIMITS.pageSize
      : articleRevision(value['pageSize']);
  if (
    pageSize > 100 ||
    number > 10000 ||
    typeof total !== 'number' ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Array.isArray(value['items']) ||
    value['items'].length > pageSize
  )
    throw new ArticleInputError('Invalid article page');
  const items = value['items'].map(parse);
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.length > Math.max(0, total - (number - 1) * pageSize)
  )
    throw new ArticleInputError('Inconsistent article page');
  return {
    items,
    page: number,
    total,
    ...(value['pageSize'] === undefined ? {} : { pageSize }),
  };
}
export function parseArticlePage(input: unknown): ArticlePage {
  return page(input, parseArticlePreview, true);
}
export function parseArticleReviewPage(input: unknown): ArticleReviewPage {
  const result = page(input, parseArticlePublicationStatus);
  if (
    result.items.some((item) => item.latestSubmission?.status !== 'submitted')
  )
    throw new ArticleInputError('Invalid pending article reviews');
  return result;
}
export function articleSelectionIds(input: unknown): string[] {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > ARTICLE_LIMITS.selection
  )
    throw new ArticleInputError('Select 1-50 article IDs');
  return [...new Set(input.map(articleId))];
}
export function parseArticleSelectionQuery(input: unknown): string[] {
  const value = articleObject(input, ['ids']);
  if (typeof value['ids'] !== 'string' || value['ids'].length > 1849)
    throw new ArticleInputError('Invalid article selection');
  return articleSelectionIds(value['ids'].split(','));
}
export function parseArticleSelection(
  input: unknown,
  requested: readonly string[]
): { items: ArticlePreview[] } {
  const ids = new Set(articleSelectionIds(requested));
  const value = articleObject(input, ['items']);
  if (!Array.isArray(value['items']) || value['items'].length > ids.size)
    throw new ArticleInputError('Invalid article selection');
  const items = value['items'].map(parseArticlePreview);
  if (
    items.some((item) => !ids.has(item.id)) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new ArticleInputError('Invalid article selection members');
  return { items };
}
