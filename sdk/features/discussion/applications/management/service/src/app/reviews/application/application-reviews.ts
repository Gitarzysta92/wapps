import {
  changeReview,
  reviewChange,
  reviewCursor,
  reviewId,
  reviewVisible,
  ReviewDeniedError,
  ReviewInputError,
  ReviewMissingError,
  ReviewConflictError,
  type ReviewChange,
} from '@sdk/features/review/core';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import type {
  ReviewActor,
  ReviewIdentifiers,
  ReviewScope,
  ReviewSnapshot,
  ReviewsRepository,
  ReviewTargets,
} from './reviews.port';

export class ApplicationReviews {
  constructor(
    private readonly repository: ReviewsRepository,
    private readonly targets: ReviewTargets,
    private readonly policy: IPolicyEvaluator,
    private readonly identifiers: ReviewIdentifiers,
    private readonly publicTenant: string,
    private readonly now: () => number = Date.now
  ) {}

  async summary(applicationId: string, actor: ReviewActor | null) {
    const scope = this.scope(applicationId, actor);
    await this.visible(scope);
    return this.recheck(scope, await this.repository.summary(scope));
  }

  async page(
    applicationId: string,
    actor: ReviewActor | null,
    cursor: string | null,
    moderation = false
  ) {
    const scope = this.scope(applicationId, actor);
    reviewCursor(cursor);
    if (moderation) await this.authorize(actor, 'moderate');
    else if (actor)
      await this.authorize(
        actor,
        actor.roles.includes('admin') ? 'moderate' : 'read'
      );
    await this.visible(scope);
    return this.recheck(
      scope,
      await this.repository.page(scope, this.reader(actor), cursor, moderation)
    );
  }

  async read(applicationId: string, id: string, actor: ReviewActor | null) {
    const scope = this.scope(applicationId, actor);
    if (actor)
      await this.authorize(
        actor,
        actor.roles.includes('admin') ? 'moderate' : 'read'
      );
    await this.visible(scope);
    const result = await this.recheck(
      scope,
      await this.repository.read(scope, this.reader(actor), reviewId(id))
    );
    if (!result) throw new ReviewMissingError('Review not found');
    return result;
  }

  async reports(
    applicationId: string,
    id: string,
    actor: ReviewActor,
    cursor: string | null
  ) {
    const scope = this.scope(applicationId, actor);
    reviewCursor(cursor);
    await this.authorize(actor, 'moderate');
    await this.visible(scope);
    return this.recheck(
      scope,
      await this.repository.reports(scope, reviewId(id), cursor)
    );
  }

  async change(
    applicationId: string,
    id: string | null,
    type: ReviewChange['type'],
    body: unknown,
    actor: ReviewActor,
    key: string
  ) {
    const scope = this.scope(applicationId, actor);
    const change = reviewChange(type, body);
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))
      throw new ReviewInputError('A valid Idempotency-Key is required');
    if (id !== null) reviewId(id);
    if (type !== 'publish' && id === null)
      throw new ReviewInputError('Review ID is required');
    if (type === 'publish' && id !== null)
      throw new ReviewInputError('Publish uses the member review slot');
    await this.authorize(actor, type);
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
        // Recheck after acquiring the application lock; queued commands cannot use an old visibility decision.
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

  private scope(applicationId: string, actor: ReviewActor | null): ReviewScope {
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
    if (tenantId !== this.publicTenant)
      throw new ReviewMissingError('Application not found');
    return { tenantId, applicationId: reviewId(applicationId) };
  }

  private reader(actor: ReviewActor | null) {
    return {
      actorId: actor?.identityId ?? null,
      moderator: actor?.roles.includes('admin') === true,
    };
  }

  private async authorize(
    actor: ReviewActor | null,
    action: ReviewChange['type'] | 'read'
  ) {
    if (!actor || (action === 'moderate' && !actor.roles.includes('admin')))
      throw new ReviewDeniedError('Review action is not permitted');
    const result = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: this.now(),
      actionName: `review.${action}`,
      subject: { roles: actor.roles },
      resource: {
        type: 'application-review-workspace',
        id: actor.identityId,
        tenantId: actor.tenantId,
      },
    });
    if (!result.ok) throw result.error;
    if (result.value !== true)
      throw new ReviewDeniedError('Review action is not permitted');
  }

  private async visible(scope: ReviewScope) {
    if (!(await this.targets.visible(scope.applicationId, scope.tenantId)))
      throw new ReviewMissingError('Application not found');
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
