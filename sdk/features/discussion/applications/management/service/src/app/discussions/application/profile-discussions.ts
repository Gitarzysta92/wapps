import {
  commentObject,
  profileDiscussionsCursor,
  parseProfileDiscussionsPage,
  PublicCommentInputError,
  PROFILE_DISCUSSIONS_PAGE_SIZE,
  type DiscussionTarget,
  type MyDiscussionCursor,
  type ProfileDiscussion,
  type PublicApplicationDiscussion,
  type PublicCommentThread,
} from '@sdk/features/discussion/core';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
} from './discussion-write.port';
import { DiscussionProjectionPendingError } from './discussion-queries';
import type { ContentClassification } from '@domains/publication/classification';

export const DISCUSSION_PROFILE_READER = 'wapps-profile-reader';
export interface ProfileDiscussionCandidate extends MyDiscussionCursor {
  target: DiscussionTarget;
  revision: number;
  participation: ProfileDiscussion['participation'];
}
export interface ProfileDiscussionIndex {
  list(
    owner: string,
    tenant: string,
    after: MyDiscussionCursor | null
  ): Promise<ProfileDiscussionCandidate[]>;
  current(
    owner: string,
    tenant: string,
    ids: string[]
  ): Promise<ProfileDiscussionCandidate[]>;
}
export interface ProfileDiscussionCursors {
  open(token: string, owner: string, tenant: string): MyDiscussionCursor;
  seal(cursor: MyDiscussionCursor, owner: string, tenant: string): string;
}
export interface ProfileDiscussionParents {
  select(
    targets: DiscussionTarget[]
  ): Promise<
    {
      target: DiscussionTarget;
      title: string;
      slug: string;
      categories?: string[];
      tags?: string[];
      classification?: ContentClassification;
    }[]
  >;
}
export interface ProfileDiscussionReader {
  read(
    target: DiscussionTarget,
    id: string
  ): Promise<PublicCommentThread | PublicApplicationDiscussion>;
}

export class ProfileDiscussions {
  constructor(
    private readonly index: ProfileDiscussionIndex,
    private readonly reader: ProfileDiscussionReader,
    private readonly parents: ProfileDiscussionParents,
    private readonly cursors: ProfileDiscussionCursors,
    private readonly policy: IPolicyEvaluator,
    private readonly tenant: string
  ) {}
  async read(input: unknown, actor: DiscussionActor) {
    const action = 'discussion.profile.participation.read';
    if (
      actor.identityId !== DISCUSSION_PROFILE_READER ||
      actor.tenantId !== this.tenant ||
      !actor.roles.includes('discussion:profile-reader')
    )
      throw new PermissionDeniedError(action);
    const body = commentObject(input, ['ownerIdentityId', 'after']);
    const owner = body['ownerIdentityId'];
    if (
      typeof owner !== 'string' ||
      !owner ||
      owner.length > 128 ||
      owner.trim() !== owner ||
      [...owner].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
    )
      throw new PublicCommentInputError('Invalid profile content owner');
    const after = profileDiscussionsCursor(body['after']);
    const permission = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: this.tenant,
      timestamp: Date.now(),
      action,
      actionName: action,
      subject: { roles: actor.roles },
      resource: {
        type: 'profile-discussion-collection',
        id: owner,
        tenantId: this.tenant,
      },
    });
    if (!permission.ok) throw permission.error;
    if (permission.value !== true) throw new PermissionDeniedError(action);
    const cursor =
      after === null ? null : this.cursors.open(after, owner, this.tenant);
    const candidates = await this.index.list(owner, this.tenant, cursor);
    if (
      candidates.length > PROFILE_DISCUSSIONS_PAGE_SIZE + 1 ||
      new Set(candidates.map((row) => row.id)).size !== candidates.length ||
      candidates.some((row, i) => {
        const previous = i === 0 ? cursor : candidates[i - 1];
        return (
          previous !== null &&
          (row.at > previous.at ||
            (row.at === previous.at && row.id <= previous.id))
        );
      })
    )
      throw new Error('Invalid profile participation page');
    const loaded: {
      candidate: ProfileDiscussionCandidate;
      thread: PublicCommentThread | PublicApplicationDiscussion;
    }[] = [];
    // Scanning is bounded; encrypted continuation permits safe progress past hidden parents.
    const scanned = candidates.slice(0, PROFILE_DISCUSSIONS_PAGE_SIZE);
    for (let offset = 0; offset < scanned.length; offset += 5) {
      const batch = await Promise.all(
        scanned.slice(offset, offset + 5).map(async (candidate) => {
          try {
            const thread = await this.reader.read(
              candidate.target,
              candidate.id
            );
            if (
              thread.id !== candidate.id ||
              thread.revision !== candidate.revision
            )
              throw new DiscussionProjectionPendingError(
                'Discussion participation changed while loading'
              );
            return { candidate, thread };
          } catch (error) {
            if (error instanceof DiscussionNotFoundError) return null;
            throw error;
          }
        })
      );
      for (const result of batch) if (result) loaded.push(result);
    }
    const parents = await this.parents.select(
      loaded.map(({ candidate }) => candidate.target)
    );
    const current = new Map(
      (
        await this.index.current(
          owner,
          this.tenant,
          loaded.map(({ candidate }) => candidate.id)
        )
      ).map((row) => [row.id, row])
    );
    const items: ProfileDiscussion[] = [];
    for (const { candidate, thread } of loaded) {
      const membership = current.get(candidate.id);
      if (!membership) continue;
      if (
        membership.revision !== thread.revision ||
        membership.at !== candidate.at ||
        membership.target.kind !== candidate.target.kind ||
        membership.target.id !== candidate.target.id
      )
        throw new DiscussionProjectionPendingError(
          'Discussion participation changed while loading'
        );
      const parent = parents.find(
        ({ target }) =>
          target.kind === candidate.target.kind &&
          target.id === candidate.target.id
      );
      if (!parent) continue;
      if (candidate.target.kind === 'application' && !('title' in thread))
        throw new Error('Missing topic title');
      items.push({
        id: candidate.id,
        parentKind: candidate.target.kind,
        parentId: candidate.target.id,
        parentSlug: parent.slug,
        title: 'title' in thread ? thread.title : parent.title,
        createdAt: candidate.at,
        replyCount: thread.replyCount,
        participation: membership.participation,
      });
    }
    const last = scanned[scanned.length - 1];
    return parseProfileDiscussionsPage({
      sharing: 'visible',
      items,
      after:
        candidates.length > PROFILE_DISCUSSIONS_PAGE_SIZE && last
          ? this.cursors.seal({ at: last.at, id: last.id }, owner, this.tenant)
          : null,
    });
  }
}
