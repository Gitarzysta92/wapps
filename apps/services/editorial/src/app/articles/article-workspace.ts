import { createHash } from 'node:crypto';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  ARTICLE_FIELD_KEYS,
  articleFieldsFrom,
  articleId,
  articleObject,
  articleRevision,
  articleTimestamp,
  parseArticlePublicationInput,
  ArticleInputError,
  ArticleUnavailableError,
  type ArticleDraft,
  type ArticleFields,
  type ArticleReceipt,
  type ArticlePublicationAction,
  type ArticlePublicationInput,
  type ArticlePublicationReceipt,
  type ArticlePublicationStatus,
  type ArticleReviewPage,
} from '@domains/publication/article';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';

export interface ArticleDraftCommand {
  actor: EditorialActor;
  key: string;
  fingerprint: string;
  id: string;
  type: 'create' | 'update' | 'delete';
  fields: ArticleFields | null;
  expectedRevision: number | null;
  at: number;
}
export interface ArticlePublicationCommand {
  actor: EditorialActor;
  key: string;
  fingerprint: string;
  id: string;
  action: ArticlePublicationAction;
  input: ArticlePublicationInput;
  at: number;
}
export interface ArticleWorkspaceStore {
  list(actor: EditorialActor): Promise<ArticleDraft[]>;
  read(actor: EditorialActor, id: string): Promise<ArticleDraft>;
  changeDraft(command: ArticleDraftCommand): Promise<ArticleReceipt>;
  status(
    actor: EditorialActor,
    id: string,
    review: boolean
  ): Promise<ArticlePublicationStatus>;
  reviews(actor: EditorialActor, page: number): Promise<ArticleReviewPage>;
  changePublication(
    command: ArticlePublicationCommand
  ): Promise<ArticlePublicationReceipt>;
}
export function assertArticleAccess(
  actor: EditorialActor,
  owner: { tenantId: string; ownerIdentityId: string },
  review = false
) {
  if (
    actor.tenantId !== owner.tenantId ||
    (review
      ? actor.identityId === owner.ownerIdentityId
      : actor.identityId !== owner.ownerIdentityId)
  )
    throw new PermissionDeniedError('editorial.article.publication');
}

export class ArticleWorkspace {
  constructor(
    private readonly store: ArticleWorkspaceStore,
    private readonly policy: IPolicyEvaluator,
    private readonly ids: { generate(): string },
    private readonly now: () => number = Date.now
  ) {}

  async list(actor: EditorialActor) {
    await this.authorize(actor, 'read');
    return this.store.list(actor);
  }
  async read(actor: EditorialActor, id: string) {
    await this.authorize(actor, 'read');
    return this.store.read(actor, articleId(id));
  }
  async change(
    actor: EditorialActor,
    type: ArticleDraftCommand['type'],
    id: string | null,
    input: unknown,
    key: string
  ) {
    await this.authorize(actor, type);
    this.key(key);
    const value = articleObject(
      input,
      type === 'delete'
        ? ['expectedRevision']
        : [
            ...ARTICLE_FIELD_KEYS,
            ...(type === 'update' ? ['expectedRevision'] : []),
          ]
    );
    const fields = type === 'delete' ? null : articleFieldsFrom(value);
    const expectedRevision =
      type === 'create' ? null : articleRevision(value['expectedRevision']);
    const target = type === 'create' ? null : articleId(id);
    return this.store.changeDraft({
      actor,
      key,
      type,
      fields,
      expectedRevision,
      id: target ?? articleId(this.ids.generate()),
      at: articleTimestamp(this.now()),
      fingerprint: this.fingerprint({
        type,
        id: target,
        fields,
        expectedRevision,
      }),
    });
  }
  async status(actor: EditorialActor, id: string, review = false) {
    await this.authorize(actor, review ? 'review' : 'read', id);
    return this.store.status(actor, articleId(id), review);
  }
  async reviews(actor: EditorialActor, page: number) {
    await this.authorize(actor, 'review');
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new ArticleInputError('Invalid article review page');
    return this.store.reviews(actor, page);
  }
  async publish(
    actor: EditorialActor,
    id: string,
    action: ArticlePublicationAction,
    input: unknown,
    key: string
  ) {
    await this.authorize(
      actor,
      action === 'approve' || action === 'reject' ? 'review' : action,
      id
    );
    this.key(key);
    const parsed = parseArticlePublicationInput(action, input);
    return this.store.changePublication({
      actor,
      id: articleId(id),
      key,
      action,
      input: parsed,
      at: articleTimestamp(this.now()),
      fingerprint: this.fingerprint({ action, id, input: parsed }),
    });
  }
  private key(key: string) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new ArticleInputError('A valid Idempotency-Key is required');
  }
  private fingerprint(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
  private async authorize(
    actor: EditorialActor,
    operation:
      | 'read'
      | 'create'
      | 'update'
      | 'delete'
      | 'submit'
      | 'withdraw'
      | 'review',
    id = actor.identityId
  ) {
    assertEditorialActor(actor);
    let result;
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName: `editorial.article.${operation}`,
        subject: { roles: actor.roles },
        resource: {
          type: operation === 'review' ? 'article-review' : 'article-workspace',
          id: operation === 'review' ? id : actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new ArticleUnavailableError('Article authorization is unavailable');
    }
    if (!result.ok)
      throw new ArticleUnavailableError('Article authorization is unavailable');
    if (result.value !== true)
      throw new PermissionDeniedError(`editorial.article.${operation}`);
  }
}
