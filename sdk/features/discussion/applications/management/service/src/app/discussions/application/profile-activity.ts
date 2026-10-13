import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  parseProfileActivity,
  parseProfileActivityBatch,
  profileActivityRequest,
  PROFILE_ACTIVITY_PAGE_SIZE,
  type ProfileActivity,
  type ProfileActivityPosition,
} from '@domains/customer/profiles';
import {
  PublicCommentInputError,
  type DiscussionTarget,
} from '@sdk/features/discussion/core';
import { ReviewMissingError } from '@sdk/features/review/core';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
} from './discussion-write.port';
import { DiscussionProjectionPendingError } from './discussion-queries';
import {
  DISCUSSION_PROFILE_READER,
  type ProfileDiscussionParents,
} from './profile-discussions';

export interface CommunityActivityCandidate {
  kind: 'discussion' | 'reply' | 'comment' | 'review';
  id: string;
  rootId: string;
  at: number;
  revision: number;
  target: DiscussionTarget;
}
export interface CommunityActivityIndex {
  read(
    owner: string,
    tenant: string,
    after: ProfileActivityPosition | null,
    discussions: boolean
  ): Promise<CommunityActivityCandidate[]>;
}
export interface CommunityActivityReader {
  read(
    candidate: CommunityActivityCandidate
  ): Promise<{ revision: number; title: string | null; live: boolean }>;
}

export class ProfileCommunityActivity {
  constructor(
    private readonly index: CommunityActivityIndex,
    private readonly reader: CommunityActivityReader,
    private readonly parents: ProfileDiscussionParents,
    private readonly policy: IPolicyEvaluator,
    private readonly tenant: string
  ) {}
  async read(input: unknown, actor: DiscussionActor) {
    const action = 'discussion.profile.activity.read';
    if (
      actor.identityId !== DISCUSSION_PROFILE_READER ||
      actor.tenantId !== this.tenant ||
      !actor.roles.includes('discussion:profile-reader')
    )
      throw new PermissionDeniedError(action);
    let request;
    try {
      request = profileActivityRequest(input);
    } catch {
      throw new PublicCommentInputError('Invalid activity request');
    }
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: this.tenant,
      timestamp: Date.now(),
      action,
      actionName: action,
      subject: { roles: actor.roles },
      resource: {
        type: 'profile-activity',
        id: request.ownerIdentityId,
        tenantId: this.tenant,
      },
    });
    if (!decision.ok)
      throw new DiscussionProjectionPendingError(
        'Activity authorization unavailable'
      );
    if (decision.value !== true) throw new PermissionDeniedError(action);
    const { ownerIdentityId, after, sharing } = request;
    const candidates = await this.index.read(
      ownerIdentityId,
      this.tenant,
      after,
      sharing.discussions
    );
    if (candidates.length > PROFILE_ACTIVITY_PAGE_SIZE + 1)
      throw new Error('Activity selection exceeds bounds');
    const scanned = candidates.slice(0, PROFILE_ACTIVITY_PAGE_SIZE);
    const loaded: {
      candidate: CommunityActivityCandidate;
      title: string | null;
    }[] = [];
    for (let offset = 0; offset < scanned.length; offset += 5) {
      const batch = await Promise.all(
        scanned.slice(offset, offset + 5).map(async (candidate) => {
          try {
            const value = await this.reader.read(candidate);
            if (value.revision !== candidate.revision)
              throw new DiscussionProjectionPendingError(
                'Activity contribution changed while loading'
              );
            return value.live ? { candidate, title: value.title } : null;
          } catch (error) {
            if (
              error instanceof DiscussionNotFoundError ||
              error instanceof ReviewMissingError
            )
              return null;
            throw error;
          }
        })
      );
      for (const value of batch) if (value) loaded.push(value);
    }
    const parents = await this.parents.select(
      loaded.map(({ candidate }) => candidate.target)
    );
    if (
      JSON.stringify(
        await this.index.read(
          ownerIdentityId,
          this.tenant,
          after,
          sharing.discussions
        )
      ) !== JSON.stringify(candidates)
    )
      throw new DiscussionProjectionPendingError(
        'Activity authority changed while loading'
      );
    const items: ProfileActivity[] = [];
    for (const { candidate, title } of loaded) {
      const parent = parents.find(
        ({ target }) =>
          target.kind === candidate.target.kind &&
          target.id === candidate.target.id
      );
      if (!parent) continue;
      const { kind, id, rootId, at } = candidate;
      items.push(
        parseProfileActivity({
          kind,
          id,
          at,
          title: title ?? parent.title,
          target:
            kind === 'comment'
              ? { kind, id: rootId, articleSlug: parent.slug }
              : {
                  kind: kind === 'reply' ? 'discussion' : kind,
                  id: rootId,
                  applicationSlug: parent.slug,
                },
        })
      );
    }
    const last = scanned[scanned.length - 1];
    return parseProfileActivityBatch({
      items,
      through:
        candidates.length > PROFILE_ACTIVITY_PAGE_SIZE
          ? { at: last.at, key: `${last.kind}:${last.id}` }
          : null,
    });
  }
}
