import { Injectable } from '@nestjs/common';
import {
  ARTICLE_COVER_RETAINED_LIMIT,
  parseArticleCoverUpload,
  parseArticleCoverUploadInput,
  parseArticleCoverUploadReceipt,
  articleCoverInteger,
  articleCoverObject,
} from '@domains/catalog/media';
import type {
  TrustedPortalIdentity,
  TrustedPortalViewer,
} from '../identity/trusted-portal-identity';
import { articleRequest, articleResult } from './portal-articles.request';
import { PortalArticlesTransport } from './portal-articles.transport';

const base = '/api/me/article-covers';
export type ArticleCoverPreview =
  | { kind: 'upload'; id: string }
  | { kind: 'submission'; id: string; revision: number; review: boolean }
  | { kind: 'published'; id: string; imageId: string };

@Injectable()
export class PortalArticleCoversClient {
  constructor(private readonly transport: PortalArticlesTransport) {}
  async list(actor: TrustedPortalIdentity, articleId: string) {
    const raw = await this.transport.send(
      actor,
      `${base}?articleId=${articleId}`
    );
    return articleResult(() => {
      if (!Array.isArray(raw) || raw.length > ARTICLE_COVER_RETAINED_LIMIT)
        throw new Error('Invalid upload list');
      const uploads = raw.map(parseArticleCoverUpload);
      if (
        uploads.some(
          (upload) =>
            upload.articleId !== articleId || upload.status === 'cancelled'
        ) ||
        new Set(uploads.map((upload) => upload.id)).size !== uploads.length
      )
        throw new Error('Unexpected uploads');
      return uploads;
    });
  }
  async read(actor: TrustedPortalIdentity, id: string, signal?: AbortSignal) {
    const raw = await this.transport.send(actor, `${base}/${id}`, { signal });
    return articleResult(() => {
      const upload = parseArticleCoverUpload(raw);
      if (upload.id !== id) throw new Error('Unexpected upload');
      return upload;
    });
  }
  async create(actor: TrustedPortalIdentity, input: unknown, key: string) {
    const body = articleRequest(() => parseArticleCoverUploadInput(input));
    const raw = await this.transport.send(actor, base, {
      method: 'POST',
      body,
      key,
    });
    return this.receipt(raw, null, 1, 'pending');
  }
  async cancel(
    actor: TrustedPortalIdentity,
    id: string,
    input: unknown,
    key: string
  ) {
    const body = articleRequest(() => ({
      expectedRevision: articleCoverInteger(
        articleCoverObject(input, ['expectedRevision']).expectedRevision
      ),
    }));
    const raw = await this.transport.send(actor, `${base}/${id}`, {
      method: 'DELETE',
      body,
      key,
    });
    return this.receipt(raw, id, body.expectedRevision + 1, 'cancelled');
  }
  async upload(
    actor: TrustedPortalIdentity,
    id: string,
    revision: number,
    bytes: Buffer,
    key: string,
    signal: AbortSignal
  ) {
    const raw = await this.transport.send(actor, `${base}/${id}/content`, {
      method: 'PUT',
      body: bytes,
      revision,
      key,
      signal,
    });
    return this.receipt(raw, id, revision + 1, 'ready');
  }
  async preview(
    actor: TrustedPortalViewer,
    target: ArticleCoverPreview,
    signal: AbortSignal
  ) {
    const { id } = target;
    const path =
      target.kind === 'upload'
        ? (`${base}/${id}/content` as const)
        : target.kind === 'published'
        ? (`/api/media/articles/${id}/${target.imageId}` as const)
        : (`${
            target.review
              ? '/api/editorial/article-reviews'
              : '/api/me/articles'
          }/${id}/submissions/${target.revision}/cover` as const);
    const bytes = await this.transport.send(actor, path, {
      binary: true,
      signal,
    });
    return articleResult(() => {
      if (!Buffer.isBuffer(bytes)) throw new Error('Invalid image bytes');
      return bytes;
    });
  }
  private receipt(
    raw: unknown,
    id: string | null,
    revision: number,
    status: 'pending' | 'ready' | 'cancelled'
  ) {
    return articleResult(() => {
      const receipt = parseArticleCoverUploadReceipt(raw);
      if (
        (id !== null && receipt.id !== id) ||
        receipt.revision !== revision ||
        receipt.status !== status
      )
        throw new Error('Unexpected upload receipt');
      return receipt;
    });
  }
}
