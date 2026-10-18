import {
  replyInboxCursor,
  publicCommentId,
  type ReplyNotificationEvent,
  type ReplyNotificationTarget,
} from '@domains/community';
import {
  DeliverNotifications,
  NotificationInboxService,
  type NotificationInboxSnapshot,
  type NotificationInboxStore,
  type NotificationSource,
  type NotificationBinding,
} from '@sdk/features/identity/libs/management';
import type { AuthorityValidationService } from '@sdk/kernel/ontology/authority';

export type ReplyInboxSnapshot =
  NotificationInboxSnapshot<ReplyNotificationEvent>;
export type ReplyInboxStore = NotificationInboxStore<ReplyNotificationEvent>;
export type ReplyNotificationSource = NotificationSource<
  ReplyNotificationEvent,
  ReplyNotificationTarget
>;
const binding: NotificationBinding<
  ReplyNotificationEvent,
  ReplyNotificationTarget
> = {
  eventKey: (event) => JSON.stringify([event.discussionId]),
  targetKey: (target) => JSON.stringify([target.discussionId]),
  cursor: replyInboxCursor,
  id: publicCommentId,
};
export class DeliverReplyNotifications extends DeliverNotifications<
  ReplyNotificationEvent,
  ReplyNotificationTarget
> {
  constructor(source: ReplyNotificationSource, store: ReplyInboxStore) {
    super(source, store, binding);
  }
}
export class ReplyInboxService extends NotificationInboxService<
  ReplyNotificationEvent,
  ReplyNotificationTarget
> {
  constructor(
    authority: AuthorityValidationService,
    store: ReplyInboxStore,
    source: ReplyNotificationSource
  ) {
    super(authority, store, source, binding);
  }
}
