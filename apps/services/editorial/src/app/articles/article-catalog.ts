import {
  articleId,
  profileArticlesCursor,
  profileArticlesPage,
  articlePreview,
  articleSelectionIds,
  articleSlug,
  parseArticleBrowseQuery,
  parseArticlePage,
  parseArticleSelection,
  parsePublishedArticle,
  ArticleNotFoundError,
  ArticleUnavailableError,
  type ArticleBrowseQuery,
  type PublishedArticle,
} from '@domains/publication/article';
import {
  inspectEditorialProjection,
  type EditorialProjectionStore,
} from '../application/editorial-materialization';

export type ArticleCatalogQuery =
  | ArticleBrowseQuery
  | { slug: string }
  | { ids: string[] }
  | { ownerIdentityId: string; after?: string | null };
export interface ArticleCatalogSelection {
  tenantId: string;
  total: number;
  items: {
    id: string;
    slug: string;
    revision: number;
    submittedRevision: number;
    publishedAt: number;
    updatedAt: number;
  }[];
}
export interface ArticleCatalogAuthority {
  select(query: ArticleCatalogQuery): Promise<ArticleCatalogSelection>;
}
export class ArticleCatalog {
  constructor(
    private readonly authority: ArticleCatalogAuthority,
    private readonly projections: Pick<EditorialProjectionStore, 'find'>
  ) {}
  async visibility(input: string) {
    const id = articleId(input);
    const selected = await this.authority.select({ ids: [id] });
    const current = selected.items.find((item) => item.id === id);
    if (!current) throw new ArticleNotFoundError('Article not found');
    return { id, tenantId: selected.tenantId, revision: current.revision };
  }
  async profile(ownerIdentityId: string, input: string | null) {
    const after = profileArticlesCursor(input);
    const result = await this.read({ ownerIdentityId, after });
    return profileArticlesPage(
      result.items.map(({ id, slug, title, excerpt, publishedAt }) => ({
        id,
        slug,
        title,
        excerpt,
        publishedAt,
      })),
      after
    );
  }
  async browse(input: ArticleBrowseQuery) {
    const query = parseArticleBrowseQuery({
      ...input,
      page: String(input.page),
      ...(input.pageSize === undefined
        ? {}
        : { pageSize: String(input.pageSize) }),
    });
    const result = await this.read(query);
    return parseArticlePage({
      items: result.items.map(articlePreview),
      total: result.total,
      page: query.page,
      ...(query.pageSize === undefined ? {} : { pageSize: query.pageSize }),
    });
  }
  async find(slug: string) {
    const result = await this.read({ slug: articleSlug(slug) });
    if (!result.items[0]) throw new ArticleNotFoundError('Article not found');
    return result.items[0];
  }
  async select(input: readonly string[]) {
    const ids = articleSelectionIds(input);
    const result = await this.read({ ids });
    return parseArticleSelection(
      { items: result.items.map(articlePreview) },
      ids
    );
  }
  private async read(query: ArticleCatalogQuery) {
    try {
      const selected = await this.authority.select(query);
      const items: PublishedArticle[] = [];
      for (let offset = 0; offset < selected.items.length; offset += 10) {
        items.push(
          ...(await Promise.all(
            selected.items.slice(offset, offset + 10).map(async (expected) => {
              const projection = inspectEditorialProjection(
                await this.projections.find('article', expected.id)
              );
              const content = projection.content;
              if (
                projection.kind !== 'article' ||
                projection.resourceId !== expected.id ||
                projection.tenantId !== selected.tenantId ||
                projection.revision !== expected.revision ||
                projection.deletedAt !== null ||
                !content ||
                !('sections' in content) ||
                content.slug !== expected.slug ||
                content.submittedRevision !== expected.submittedRevision ||
                content.publishedAt !== expected.publishedAt ||
                content.updatedAt !== expected.updatedAt
              )
                throw new ArticleUnavailableError(
                  'Article publication is updating. Try again shortly.'
                );
              return parsePublishedArticle({
                ...content,
                id: expected.id,
                revision: expected.revision,
              });
            })
          ))
        );
      }
      if (
        JSON.stringify(await this.authority.select(query)) !==
        JSON.stringify(selected)
      )
        throw new ArticleUnavailableError(
          'Article publication changed while loading. Try again.'
        );
      return { items, total: selected.total };
    } catch (error) {
      if (error instanceof ArticleUnavailableError) throw error;
      throw new ArticleUnavailableError(
        'Article catalog is unavailable. Try again shortly.'
      );
    }
  }
}
