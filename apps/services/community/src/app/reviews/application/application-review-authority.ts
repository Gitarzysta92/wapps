import { applicationReviewTarget } from '@domains/community';
import { ReviewMissingError } from '@sdk/features/review/core';
import type {
  ReviewAction,
  ReviewActor,
  ReviewAuthority,
  ReviewScope,
} from '@sdk/features/review/libs/management';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import type { ReviewTargets } from './reviews.port';

export class ApplicationReviewAuthority implements ReviewAuthority {
  constructor(
    private readonly targets: ReviewTargets,
    private readonly policy: IPolicyEvaluator,
    private readonly publicTenant: string,
    private readonly now: () => number
  ) {}

  visible(scope: ReviewScope) {
    const id = this.target(scope);
    return this.targets.visible(id, scope.tenantId);
  }

  async authorize(
    scope: ReviewScope,
    actor: ReviewActor | null,
    action: ReviewAction
  ) {
    this.target(scope);
    const moderator = actor?.roles.includes('admin') === true;
    if (!actor) return { allowed: action === 'read', moderator: false };
    if (action === 'moderate' && !moderator)
      return { allowed: false, moderator };
    const result = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: this.now(),
      actionName: `review.${
        action === 'read' && moderator ? 'moderate' : action
      }`,
      subject: { roles: actor.roles },
      resource: {
        type: 'application-review-workspace',
        id: actor.identityId,
        tenantId: actor.tenantId,
      },
    });
    if (!result.ok) throw result.error;
    return { allowed: result.value === true, moderator };
  }

  private target(scope: ReviewScope) {
    if (scope.tenantId !== this.publicTenant)
      throw new ReviewMissingError('Application not found');
    return applicationReviewTarget(scope.bindingKey);
  }
}
