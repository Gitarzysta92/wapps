import {
  parseFavoriteTarget,
  parseFavoriteUpdateState,
  type FavoriteTarget,
  type FavoriteUpdateState,
} from '@domains/customer/favorites';
import {
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
} from '@sdk/features/discussion/core';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';

export interface FavoriteUpdateSource {
  read(target: FavoriteTarget): Promise<FavoriteUpdateState>;
}

export class FavoriteUpdateSourceAccess {
  constructor(
    private readonly source: FavoriteUpdateSource,
    private readonly policy: IPolicyEvaluator,
    private readonly service: 'editorial' | 'discussion'
  ) {}
  async read(
    input: unknown,
    actor: { identityId: string; tenantId: string; roles: string[] }
  ): Promise<FavoriteUpdateState> {
    const action = `${this.service}.favorite-updates.read`;
    if (
      actor.identityId !== NOTIFICATION_WORKER_ID ||
      actor.tenantId !== NOTIFICATION_WORKER_SCOPE ||
      !actor.roles.includes(NOTIFICATION_WORKER_ROLE)
    )
      throw new PermissionDeniedError(action);
    const decision = await this.policy.evaluate({
      ...actor,
      action,
      actionName: action,
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: {
        type: 'favorite-updates',
        id: this.service,
        tenantId: actor.tenantId,
      },
    });
    if (!decision.ok) throw decision.error;
    if (decision.value !== true) throw new PermissionDeniedError(action);
    const target = parseFavoriteTarget(input);
    if ((target.kind === 'discussions') !== (this.service === 'discussion'))
      throw new PermissionDeniedError(action);
    const result = parseFavoriteUpdateState(await this.source.read(target));
    if (result.target.kind !== target.kind || result.target.id !== target.id)
      throw new Error('Favorite update scope differs');
    return result;
  }
}
