import {
  changeReview,
  reviewChange,
  reviewCursor,
  reviewId,
  reviewBindingKey,
  reviewVisible,
  ReviewDeniedError,
  ReviewInputError,
  ReviewMissingError,
  ReviewConflictError,
  type ReviewChange,
} from '@sdk/features/review/core';
import type {
  ReviewActor,
  ReviewIdentifiers,
  ReviewScope,
  ReviewSnapshot,
  ReviewsRepository,
  ReviewAuthority,
} from './reviews.port';

export class Reviews {
  constructor(
    private readonly repository: ReviewsRepository,
    private readonly authority: ReviewAuthority,
    private readonly identifiers: ReviewIdentifiers,
    private readonly publicTenant: string,
    private readonly now: () => number = Date.now
  ) {}

  async summary(bindingKey: string, actor: ReviewActor | null) {
    const scope = this.scope(bindingKey, actor);
    await this.visible(scope);
    return this.recheck(scope, await this.repository.summary(scope));
  }

  async page(
    bindingKey: string,
    actor: ReviewActor | null,
    cursor: string | null,
    moderation = false
  ) {
    const scope = this.scope(bindingKey, actor);
    reviewCursor(cursor);
    const reader = await this.authorize(
      scope,
      actor,
      moderation ? 'moderate' : 'read'
    );
    await this.visible(scope);
    return this.recheck(
      scope,
      await this.repository.page(scope, reader, cursor, moderation)
    );
  }

  async read(bindingKey: string, id: string, actor: ReviewActor | null) {
    const scope = this.scope(bindingKey, actor);
    const reader = await this.authorize(scope, actor, 'read');
    await this.visible(scope);
    const result = await this.recheck(
      scope,
      await this.repository.read(scope, reader, reviewId(id))
    );
    if (!result) throw new ReviewMissingError('Review not found');
    return result;
  }

  async reports(
    bindingKey: string,
    id: string,
    actor: ReviewActor,
    cursor: string | null
  ) {
    const scope = this.scope(bindingKey, actor);
    reviewCursor(cursor);
    await this.authorize(scope, actor, 'moderate');
    await this.visible(scope);
    return this.recheck(
      scope,
      await this.repository.reports(scope, reviewId(id), cursor)
    );
  }

  async change(
    bindingKey: string,
    id: string | null,
    type: ReviewChange['type'],
    body: unknown,
    actor: ReviewActor,
    key: string
  ) {
    if (!actor)
      throw new ReviewDeniedError('Authenticated review actor required');
    const scope = this.scope(bindingKey, actor);
    const change = reviewChange(type, body);
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))
      throw new ReviewInputError('A valid Idempotency-Key is required');
    if (id !== null) reviewId(id);
    if (type !== 'publish' && id === null)
      throw new ReviewInputError('Review ID is required');
    if (type === 'publish' && id !== null)
      throw new ReviewInputError('Publish uses the member review slot');
    await this.authorize(scope, actor, type);
    await this.visible(scope);
    const command = {
      actorId: actor.identityId,
      key,
      fingerprint: this.identifiers.fingerprint(JSON.stringify({ id, change })),
    };
    return this.repository.transaction(
      scope,
      actor.identityId,
      async (tx) => {
        // Recheck after acquiring the binding lock; queued commands cannot use an old visibility decision.
        await this.visible(scope);
        const receipt = await tx.receipt(command);
        if (receipt) return receipt;
        const current =
          id === null ? await tx.own(actor.identityId) : await tx.find(id);
        if (id !== null && !current)
          throw new ReviewMissingError('Review not found');
        if (current) {
          const owner = current.ownerId === actor.identityId;
          if ((type === 'publish' || type === 'withdraw') && !owner)
            throw new ReviewDeniedError(
              'Only the author can change this review'
            );
          if (
            (type === 'helpful' || type === 'report' || type === 'moderate') &&
            owner
          )
            throw new ReviewDeniedError('This action requires another member');
          if (
            (type === 'helpful' || type === 'report') &&
            !reviewVisible(current)
          )
            throw new ReviewMissingError('Review not found');
        }
        const next = changeReview(current, change);
        const at = this.now();
        const content =
          change.type === 'publish' ? change.content : current?.content;
        if (!content) throw new ReviewMissingError('Review content is missing');
        return tx.commit({
          command,
          change,
          at,
          record: {
            ...next,
            id: current?.id ?? this.identifiers.next(),
            ownerId: current ? current.ownerId : actor.identityId,
            content,
            createdAt: current?.createdAt ?? at,
            updatedAt:
              type === 'publish'
                ? Math.max(at, current?.updatedAt ?? at)
                : current?.updatedAt ?? at,
          },
        });
      },
      id
    );
  }

  private scope(bindingKey: string, actor: ReviewActor | null): ReviewScope {
    if (
      actor &&
      (typeof actor.identityId !== 'string' ||
        !actor.identityId ||
        actor.identityId.length > 128 ||
        typeof actor.tenantId !== 'string' ||
        !actor.tenantId ||
        actor.tenantId.length > 128 ||
        !Array.isArray(actor.roles) ||
        actor.roles.length > 64 ||
        actor.roles.some(
          (role) => typeof role !== 'string' || role.length > 128
        ))
    )
      throw new ReviewDeniedError('Invalid review actor');
    const tenantId = actor?.tenantId ?? this.publicTenant;
    return { tenantId, bindingKey: reviewBindingKey(bindingKey) };
  }

  private async authorize(
    scope: ReviewScope,
    actor: ReviewActor | null,
    action: ReviewChange['type'] | 'read'
  ) {
    if (action !== 'read' && !actor)
      throw new ReviewDeniedError('Authenticated review actor required');
    const grant = await this.authority.authorize(scope, actor, action);
    if (
      grant.allowed !== true ||
      (action === 'moderate' && grant.moderator !== true)
    )
      throw new ReviewDeniedError('Review action is not permitted');
    return {
      actorId: actor?.identityId ?? null,
      moderator: grant.moderator === true,
    };
  }

  private async visible(scope: ReviewScope) {
    if (!(await this.authority.visible(scope)))
      throw new ReviewMissingError('Review context not found');
  }

  private async recheck<T>(
    scope: ReviewScope,
    snapshot: ReviewSnapshot<T>
  ): Promise<T> {
    await this.visible(scope);
    if ((await this.repository.revision(scope)) !== snapshot.revision)
      throw new ReviewConflictError(
        'Reviews changed while loading. Reload to continue.'
      );
    return snapshot.value;
  }
}
