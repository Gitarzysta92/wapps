import {
  commentObject,
  notificationRecipient,
  publicCommentId,
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
  MENTION_NOTIFICATION_PAGE_SIZE,
  PublicCommentInputError,
  type DiscussionTarget,
  type MentionNotificationEvent,
  type MentionNotificationLease,
  type MentionNotificationTarget,
} from '@sdk/features/discussion/core';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import { discussionMentionRecipients } from '@sdk/features/discussion/core';
import type { DiscussionMentionDirectory } from './discussion-mentions.port';
import type { DiscussionActor } from './discussion-write.port';
import type { ProfileDiscussionParents } from './profile-discussions';

export interface MentionNotificationCandidate {
  event: MentionNotificationEvent;
  target: DiscussionTarget;
  currentRevision: number;
  authorId: string;
  profileId: string;
}

export interface MentionNotificationJournal {
  claim(): Promise<MentionNotificationLease | null>;
  settle(
    id: string,
    token: string,
    failed: boolean
  ): Promise<'settled' | 'superseded'>;
  current(
    recipient: string,
    ids: string[],
    tenant: string
  ): Promise<MentionNotificationCandidate[]>;
}

export class DiscussionMentionNotifications {
  constructor(
    private readonly journal: MentionNotificationJournal,
    private readonly parents: ProfileDiscussionParents,
    private readonly policy: IPolicyEvaluator,
    private readonly tenant: string,
    private readonly directory: DiscussionMentionDirectory
  ) {}

  async execute(input: unknown, actor: DiscussionActor): Promise<unknown> {
    const action = 'discussion.mentions.manage';
    if (
      actor.identityId !== NOTIFICATION_WORKER_ID ||
      actor.tenantId !== NOTIFICATION_WORKER_SCOPE ||
      !actor.roles.includes(NOTIFICATION_WORKER_ROLE)
    )
      throw new PermissionDeniedError(action);
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: Date.now(),
      action,
      actionName: action,
      subject: { roles: actor.roles },
      resource: {
        type: 'mention-notifications',
        id: 'discussion',
        tenantId: actor.tenantId,
      },
    });
    if (!decision.ok) throw decision.error;
    if (decision.value !== true) throw new PermissionDeniedError(action);
    const body = commentObject(input, [
      'operation',
      'id',
      'token',
      'recipientId',
      'ids',
    ]);
    if (body['operation'] === 'claim') {
      commentObject(body, ['operation']);
      return { lease: await this.journal.claim() };
    }
    if (body['operation'] === 'ack' || body['operation'] === 'defer') {
      commentObject(body, ['operation', 'id', 'token']);
      return {
        status: await this.journal.settle(
          publicCommentId(body['id']),
          publicCommentId(body['token']),
          body['operation'] === 'defer'
        ),
      };
    }
    if (body['operation'] !== 'resolve')
      throw new PublicCommentInputError('Unsupported notification operation');
    commentObject(body, ['operation', 'recipientId', 'ids']);
    const recipient = notificationRecipient(body['recipientId']);
    if (
      !Array.isArray(body['ids']) ||
      body['ids'].length > MENTION_NOTIFICATION_PAGE_SIZE
    )
      throw new PublicCommentInputError(
        'Notification selection exceeds bounds'
      );
    const ids = body['ids'].map(publicCommentId);
    if (new Set(ids).size !== ids.length)
      throw new PublicCommentInputError('Duplicate notification IDs');
    const before = await this.journal.current(recipient, ids, this.tenant);
    const parents = await this.parents.select(before.map((row) => row.target));
    const eligible = new Set<string>();
    for (const row of before) {
      const recipients = discussionMentionRecipients(
        await this.directory.resolve(row.authorId, [row.profileId]),
        [row.profileId]
      );
      if (
        recipients.some(
          (item) =>
            item.profileId === row.profileId && item.identityId === recipient
        )
      )
        eligible.add(row.event.id);
    }
    const after = await this.journal.current(recipient, ids, this.tenant);
    const items: MentionNotificationTarget[] = [];
    for (const row of before) {
      const current = after.find((item) => item.event.id === row.event.id);
      if (!current) continue;
      if (JSON.stringify(row) !== JSON.stringify(current))
        throw new Error('Notification source changed during selection');
      const parent = parents.find(
        (item) =>
          item.target.id === row.target.id &&
          item.target.kind === row.target.kind
      );
      if (parent && eligible.has(row.event.id))
        items.push({
          id: row.event.id,
          nodeId: row.event.nodeId,
          discussionId: row.event.discussionId,
          target: row.target,
          title: parent.title,
          slug: parent.slug,
        });
    }
    return { items };
  }
}
