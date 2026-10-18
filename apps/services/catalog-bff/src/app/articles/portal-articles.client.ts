import { Injectable } from '@nestjs/common';
import {
  ARTICLE_FIELD_KEYS,
  ARTICLE_LIMITS,
  articleFieldsFrom,
  articleId,
  articleObject,
  articleRevision,
  parseArticleDraft,
  parseArticleReceipt,
  parseArticlePublicationStatus,
  parseArticlePublicationReceipt,
  parseArticleReviewPage,
  parseArticlePage,
  parseArticleSelection,
  parsePublishedArticle,
  type ArticleBrowseQuery,
  type ArticlePublicationAction,
  type ArticlePublicationInput,
} from '@domains/publication/article';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import { articleRequest, articleResult } from './portal-articles.request';
import { PortalArticlesTransport } from './portal-articles.transport';

const drafts = '/api/me/articles';
const reviews = '/api/editorial/article-reviews';
export type ArticleDraftAction = 'create' | 'update' | 'delete';

@Injectable()
export class PortalArticlesClient {
  constructor(private readonly transport: PortalArticlesTransport) {}

  async list(actor: TrustedPortalIdentity) {
    const raw = await this.transport.send(actor, drafts);
    return articleResult(() => {
      if (!Array.isArray(raw) || raw.length > ARTICLE_LIMITS.drafts)
        throw new Error('Invalid article workspace');
      const items = raw.map(parseArticleDraft);
      if (new Set(items.map((item) => item.id)).size !== items.length)
        throw new Error('Duplicate article draft');
      return items;
    });
  }
  async read(actor: TrustedPortalIdentity, id: string) {
    const raw = await this.transport.send(actor, `${drafts}/${id}`);
    return articleResult(() => {
      const result = parseArticleDraft(raw);
      if (result.id !== id) throw new Error('Unexpected article draft');
      return result;
    });
  }
  async draft(
    actor: TrustedPortalIdentity,
    action: ArticleDraftAction,
    id: string | null,
    input: unknown,
    key: string
  ) {
    const command = articleRequest(() => {
      const value = articleObject(
        input,
        action === 'delete'
          ? ['expectedRevision']
          : [
              ...ARTICLE_FIELD_KEYS,
              ...(action === 'update' ? ['expectedRevision'] : []),
            ]
      );
      const revision =
        action === 'create' ? 0 : articleRevision(value.expectedRevision);
      return {
        id: action === 'create' ? null : articleId(id),
        revision,
        body: {
          ...(action === 'delete' ? {} : articleFieldsFrom(value)),
          ...(action === 'create' ? {} : { expectedRevision: revision }),
        },
      };
    });
    const raw = await this.transport.send(
      actor,
      command.id === null ? drafts : `${drafts}/${command.id}`,
      {
        method:
          action === 'create' ? 'POST' : action === 'update' ? 'PUT' : 'DELETE',
        body: command.body,
        key,
      }
    );
    return articleResult(() => {
      const result = parseArticleReceipt(raw);
      if (
        (command.id !== null && result.id !== command.id) ||
        result.revision !== command.revision + 1 ||
        result.deleted !== (action === 'delete')
      )
        throw new Error('Unexpected article receipt');
      return result;
    });
  }
  async status(actor: TrustedPortalIdentity, id: string, review: boolean) {
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}` : `${drafts}/${id}/publication`
    );
    return articleResult(() => {
      const result = parseArticlePublicationStatus(raw);
      if (result.id !== id) throw new Error('Unexpected article publication');
      return result;
    });
  }
  async reviews(actor: TrustedPortalIdentity, page: number) {
    const raw = await this.transport.send(actor, `${reviews}?page=${page}`);
    return articleResult(() => {
      const result = parseArticleReviewPage(raw);
      if (result.page !== page) throw new Error('Unexpected review page');
      return result;
    });
  }
  async publish(
    actor: TrustedPortalIdentity,
    id: string,
    action: ArticlePublicationAction,
    input: ArticlePublicationInput,
    key: string
  ) {
    const review = action === 'approve' || action === 'reject';
    const raw = await this.transport.send(
      actor,
      review ? `${reviews}/${id}/decision` : `${drafts}/${id}/${action}`,
      {
        method: 'POST',
        key,
        body: {
          expectedRevision: input.expectedRevision,
          expectedPublicationRevision: input.expectedPublicationRevision,
          ...(review
            ? {
                decision: action,
                submittedRevision: input.submittedRevision,
                reason: input.reason,
              }
            : {}),
        },
      }
    );
    return articleResult(() => {
      const result = parseArticlePublicationReceipt(raw);
      if (
        result.id !== id ||
        result.action !== action ||
        result.revision !== input.expectedRevision + 1 ||
        (review && result.submittedRevision !== input.submittedRevision) ||
        (action === 'approve' &&
          result.publicationRevision !==
            (input.expectedPublicationRevision ?? 0) + 1) ||
        ((action === 'submit' || action === 'reject') &&
          result.publicationRevision !== input.expectedPublicationRevision) ||
        (action === 'withdraw' &&
          result.publicationRevision !== input.expectedPublicationRevision &&
          (input.expectedPublicationRevision === null ||
            result.publicationRevision !==
              input.expectedPublicationRevision + 1))
      )
        throw new Error('Unexpected article publication receipt');
      return result;
    });
  }
  async browse(actor: TrustedPortalViewer, query: ArticleBrowseQuery) {
    const params = new URLSearchParams(
      Object.entries(query).map(([key, value]): [string, string] => [
        key,
        String(value),
      ])
    );
    const raw = await this.transport.send(
      actor,
      `/api/catalog/articles?${params}`
    );
    return articleResult(() => {
      const result = parseArticlePage(raw);
      if (
        result.page !== query.page ||
        result.pageSize !== query.pageSize ||
        result.items.some(
          (item) =>
            (query.category !== '' && item.category !== query.category) ||
            (query.tag !== '' && !item.tags.includes(query.tag))
        )
      )
        throw new Error('Unexpected article page');
      return result;
    });
  }
  async find(actor: TrustedPortalViewer, slug: string) {
    const raw = await this.transport.send(
      actor,
      `/api/catalog/articles/${slug}`
    );
    return articleResult(() => {
      const result = parsePublishedArticle(raw);
      if (result.slug !== slug) throw new Error('Unexpected public article');
      return result;
    });
  }
  async select(actor: TrustedPortalViewer, ids: string[]) {
    const raw = await this.transport.send(
      actor,
      `/api/catalog/article-selection?${new URLSearchParams({
        ids: ids.join(','),
      })}`
    );
    return articleResult(() => parseArticleSelection(raw, ids));
  }
  async visibility(actor: TrustedPortalViewer, id: string) {
    const raw = await this.transport.send(
      actor,
      `/api/catalog/article-visibility/${id}`
    );
    return articleResult(() => {
      const value = articleObject(raw, ['id', 'tenantId', 'revision']);
      const tenantId = value.tenantId;
      if (
        articleId(value.id) !== id ||
        typeof tenantId !== 'string' ||
        !tenantId ||
        tenantId.length > 128 ||
        tenantId.trim() !== tenantId ||
        [...tenantId].some((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127;
        })
      )
        throw new Error('Unexpected article visibility');
      return { id, tenantId, revision: articleRevision(value.revision) };
    });
  }
}
