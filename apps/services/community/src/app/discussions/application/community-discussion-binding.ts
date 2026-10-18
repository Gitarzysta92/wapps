import {
  discussionTarget,
  boundDiscussionContent,
  discussionMentionProfiles,
  discussionMentionRecipients,
  type DiscussionTarget,
} from '@domains/community';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import { isErr } from '@sdk/kernel/standard';
import type {
  DiscussionBindings,
  DiscussionBindingAccess,
  DiscussionChanges,
  DiscussionResource as BoundResource,
} from '@sdk/features/discussion/libs/management';
import {
  DiscussionNotFoundError,
  DiscussionValidationError,
  type DiscussionActor,
} from './discussion-write.port';
import type { DiscussionTargets } from './discussion-targets.port';
import type { DiscussionMentionDirectory } from './discussion-mentions.port';
import { presentAnonymousDiscussionPayload } from './discussion-anonymity';

/** Wapps owns this key format. The Discussion capability only stores and compares it. */
export function communityDiscussionKey(input: DiscussionTarget): string {
  const target = discussionTarget(input);
  return `${target.kind}:${target.id}`;
}

export function communityDiscussionTarget(key: string): DiscussionTarget {
  const separator = key.indexOf(':');
  const target = discussionTarget({
    kind: key.slice(0, separator),
    id: key.slice(separator + 1),
  });
  if (communityDiscussionKey(target) !== key)
    throw new DiscussionValidationError('Invalid community discussion key');
  return target;
}

export class CommunityDiscussionAccess implements DiscussionBindingAccess {
  constructor(protected readonly targets?: DiscussionTargets) {}
  async visible(key: string, tenantId: string): Promise<boolean> {
    return this.targets
      ? this.targets.visible(communityDiscussionTarget(key), tenantId)
      : false;
  }
  anonymous(key: string | undefined, payload: unknown): unknown {
    return presentAnonymousDiscussionPayload(
      payload,
      key === undefined ? undefined : communityDiscussionTarget(key)
    );
  }
}

export class CommunityDiscussionBindings
  extends CommunityDiscussionAccess
  implements DiscussionBindings
{
  constructor(
    private readonly policy: IPolicyEvaluator,
    targets?: DiscussionTargets,
    private readonly mentions?: DiscussionMentionDirectory
  ) {
    super(targets);
  }

  content(
    key: string,
    kind: 'discussion' | 'comment',
    value: unknown
  ): unknown {
    return boundDiscussionContent(communityDiscussionTarget(key), kind, value);
  }

  async authorize(
    key: string,
    actor: DiscussionActor,
    action: string,
    resource?: BoundResource,
    changes?: DiscussionChanges
  ): Promise<void> {
    const target = communityDiscussionTarget(key);
    if (!this.targets)
      throw new DiscussionNotFoundError(
        'Community discussion authority is unavailable'
      );
    if (
      changes &&
      ((changes.state && changes.state !== 'published') ||
        (changes.visibility && changes.visibility !== 'public') ||
        (action === 'create-discussion' && changes.subjectId !== target.id))
    )
      throw new DiscussionValidationError(
        'Community discussions must be public and linked to their target'
      );
    if (
      action === 'discussion.update' &&
      resource?.ownerIdentityId !== actor.identityId
    )
      throw new PermissionDeniedError(action);
    if (
      (action === 'discussion.vote' || action === 'discussion.pin') &&
      target.kind !== 'application'
    )
      throw new DiscussionValidationError(
        'This community discussion does not support votes or pins'
      );
    const actions: Record<string, string> = {
      'create-discussion': 'create',
      'create-comment': 'reply',
      'discussion.update': 'update',
      'discussion.delete': 'delete',
      'discussion.vote': 'vote',
      'discussion.pin': 'pin',
    };
    if (!actions[action]) throw new PermissionDeniedError(action);
    const workspace =
      target.kind === 'article' ? 'article-comment' : 'application-topic';
    const requestedAction = `discussion.${workspace}.${actions[action]}`;
    const result = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: Date.now(),
      action: requestedAction,
      actionName: requestedAction,
      subject: actor.roles.length ? { roles: actor.roles } : undefined,
      resource: {
        type: `${workspace}-workspace`,
        id: actor.identityId,
        tenantId: actor.tenantId,
      },
    });
    if (isErr(result)) throw result.error;
    if (result.value !== true) throw new PermissionDeniedError(action);
  }

  async context(
    _key: string,
    content: unknown,
    actor: DiscussionActor
  ): Promise<unknown> {
    const profiles = discussionMentionProfiles(
      content && typeof content === 'object' && 'mentions' in content
        ? content.mentions
        : []
    );
    if (!profiles.length) return [];
    if (!this.mentions)
      throw new Error('Mention recipient authority is not configured');
    const recipients = discussionMentionRecipients(
      await this.mentions.resolve(actor.identityId, profiles),
      profiles
    );
    if (recipients.some((row) => row.identityId === actor.identityId))
      throw new Error('Mention recipient authority returned the author');
    return recipients;
  }

  fingerprintInput(input: unknown): unknown {
    if (!input || typeof input !== 'object' || !('bindingKey' in input))
      return input;
    const { bindingKey, ...fields } = input;
    if (typeof bindingKey !== 'string')
      throw new DiscussionValidationError('Invalid discussion binding');
    // Preserve pre-refactor receipts byte-for-byte; only the consumer knows that old request shape.
    return { ...fields, target: communityDiscussionTarget(bindingKey) };
  }
}
