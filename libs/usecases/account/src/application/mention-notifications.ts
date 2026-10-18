import {
  mentionInboxCursor,
  publicCommentId,
  type MentionNotificationEvent,
  type MentionNotificationTarget,
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

export type MentionInboxSnapshot =
  NotificationInboxSnapshot<MentionNotificationEvent>;
export type MentionInboxStore =
  NotificationInboxStore<MentionNotificationEvent>;
export type MentionNotificationSource = NotificationSource<
  MentionNotificationEvent,
  MentionNotificationTarget
>;
const binding: NotificationBinding<
  MentionNotificationEvent,
  MentionNotificationTarget
> = {
  eventKey: (event) => JSON.stringify([event.discussionId, event.nodeId]),
  targetKey: (target) => JSON.stringify([target.discussionId, target.nodeId]),
  cursor: mentionInboxCursor,
  id: publicCommentId,
};
export class DeliverMentionNotifications extends DeliverNotifications<
  MentionNotificationEvent,
  MentionNotificationTarget
> {
  constructor(source: MentionNotificationSource, store: MentionInboxStore) {
    super(source, store, binding);
  }
}
export class MentionInboxService extends NotificationInboxService<
  MentionNotificationEvent,
  MentionNotificationTarget
> {
  constructor(
    authority: AuthorityValidationService,
    store: MentionInboxStore,
    source: MentionNotificationSource
  ) {
    super(authority, store, source, binding);
  }
}
