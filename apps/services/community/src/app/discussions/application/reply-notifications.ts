import { classificationFields } from '@domains/publication/classification';
import {
  commentObject,
  notificationRecipient,
  publicCommentId,
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
  REPLY_NOTIFICATION_PAGE_SIZE,
  PublicCommentInputError,
  type DiscussionTarget,
  type ReplyNotificationEvent,
  type ReplyNotificationLease,
  type ReplyNotificationTarget,
} from '@domains/community';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import type { DiscussionActor } from './discussion-write.port';
import type { ProfileDiscussionParents } from './profile-discussions';

export interface ReplyNotificationCandidate {
  event: ReplyNotificationEvent;
  target: DiscussionTarget;
  currentRevision: number;
}

export interface ReplyNotificationJournal {
  claim(): Promise<ReplyNotificationLease | null>;
  settle(
    id: string,
    token: string,
    failed: boolean
  ): Promise<'settled' | 'superseded'>;
  current(
    recipient: string,
    ids: string[],
    tenant: string
  ): Promise<ReplyNotificationCandidate[]>;
}

export class DiscussionReplyNotifications {
  constructor(
    private readonly journal: ReplyNotificationJournal,
    private readonly parents: ProfileDiscussionParents,
    private readonly policy: IPolicyEvaluator,
    private readonly tenant: string
  ) {}

  async execute(input: unknown, actor: DiscussionActor): Promise<unknown> {
    const action = 'discussion.notifications.manage';
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
        type: 'reply-notifications',
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
      body['ids'].length > REPLY_NOTIFICATION_PAGE_SIZE
    )
      throw new PublicCommentInputError(
        'Notification selection exceeds bounds'
      );
    const ids = body['ids'].map(publicCommentId);
    if (new Set(ids).size !== ids.length)
      throw new PublicCommentInputError('Duplicate notification IDs');
    const before = await this.journal.current(recipient, ids, this.tenant);
    const parents = await this.parents.select(before.map((row) => row.target));
    const after = await this.journal.current(recipient, ids, this.tenant);
    const items: ReplyNotificationTarget[] = [];
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
      if (parent)
        items.push({
          id: row.event.id,
          discussionId: row.event.discussionId,
          target: row.target,
          ...classificationFields(parent.classification),
          title: parent.title,
          slug: parent.slug,
        });
    }
    return { items };
  }
}
