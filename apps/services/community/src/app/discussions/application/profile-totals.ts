import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import { profileTotalsRequest, profileTotal } from '@domains/customer/profiles';
import {
  publicCommentId,
  PublicCommentInputError,
  type DiscussionTarget,
} from '@domains/community';
import type { DiscussionActor } from './discussion-write.port';
import {
  DISCUSSION_PROFILE_READER,
  type ProfileDiscussionParents,
} from './profile-discussions';

export const PROFILE_TOTAL_PARENT_LIMIT = 200;
export interface ProfileDiscussionTotalGroup {
  target: DiscussionTarget;
  total: number;
}
export interface ProfileDiscussionTotalsIndex {
  read(owner: string, tenant: string): Promise<ProfileDiscussionTotalGroup[]>;
}

export class ProfileDiscussionTotals {
  constructor(
    private readonly index: ProfileDiscussionTotalsIndex,
    private readonly parents: ProfileDiscussionParents,
    private readonly policy: IPolicyEvaluator,
    private readonly tenant: string
  ) {}
  async read(input: unknown, actor: DiscussionActor) {
    const action = 'discussion.profile.totals.read';
    if (
      actor.identityId !== DISCUSSION_PROFILE_READER ||
      actor.tenantId !== this.tenant ||
      !actor.roles.includes('discussion:profile-reader')
    )
      throw new PermissionDeniedError(action);
    let request;
    try {
      request = profileTotalsRequest(input, ['discussions']);
    } catch {
      throw new PublicCommentInputError('Invalid profile totals request');
    }
    const permission = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: this.tenant,
      action,
      actionName: action,
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: {
        type: 'profile-totals',
        id: request.ownerIdentityId,
        tenantId: this.tenant,
      },
    });
    if (!permission.ok) throw permission.error;
    if (permission.value !== true) throw new PermissionDeniedError(action);
    const groups = await this.index.read(request.ownerIdentityId, this.tenant);
    const key = (target: DiscussionTarget) => `${target.kind}:${target.id}`;
    if (
      groups.length > PROFILE_TOTAL_PARENT_LIMIT ||
      new Set(groups.map((row) => key(row.target))).size !== groups.length
    )
      throw new Error('Profile totals selection exceeds bounds');
    for (const row of groups) {
      publicCommentId(row.target.id);
      profileTotal(row.total);
      if (
        !['application', 'article'].includes(row.target.kind) ||
        row.total === 0
      )
        throw new Error('Invalid profile totals authority');
    }
    let total = 0;
    // Bound parent I/O: up to five batches of ten at a time; no page-length approximation.
    for (let offset = 0; offset < groups.length; offset += 50) {
      const batches = [];
      for (let i = offset; i < Math.min(offset + 50, groups.length); i += 10)
        batches.push(groups.slice(i, i + 10));
      const counts = await Promise.all(
        batches.map(async (batch) => {
          const selected = await this.parents.select(
            batch.map((row) => row.target)
          );
          const keys = new Set(selected.map((row) => key(row.target)));
          if (
            keys.size !== selected.length ||
            selected.some(
              (row) =>
                !batch.some((group) => key(group.target) === key(row.target))
            )
          )
            throw new Error('Invalid total parent selection');
          return batch.reduce(
            (sum, row) => sum + (keys.has(key(row.target)) ? row.total : 0),
            0
          );
        })
      );
      total += counts.reduce((sum, value) => sum + value, 0);
    }
    if (
      JSON.stringify(
        await this.index.read(request.ownerIdentityId, this.tenant)
      ) !== JSON.stringify(groups)
    )
      throw new Error('Discussion totals changed while loading');
    return { discussions: profileTotal(total) };
  }
}
