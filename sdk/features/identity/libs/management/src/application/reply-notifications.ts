import {
  commentObject,
  publicCommentId,
  replyInboxCursor,
  type ReplyNotificationEvent,
  type ReplyNotificationLease,
  type ReplyNotificationTarget,
  type ReplyInboxPage,
} from '@sdk/features/discussion/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import type { IdentityManagementContext } from './models/identity-management-context';

export interface ReplyInboxSnapshot {
  revision: number;
  enabled: boolean;
  entries: { event: ReplyNotificationEvent; readAt: number | null }[];
}
export interface ReplyInboxStore {
  receive(
    event: ReplyNotificationEvent,
    visible: boolean
  ): Promise<'delivered' | 'suppressed'>;
  list(
    identityId: string,
    cursor: ReturnType<typeof replyInboxCursor>
  ): Promise<ReplyInboxSnapshot>;
  current(identityId: string, ids: string[]): Promise<ReplyInboxSnapshot>;
  markRead(
    identityId: string,
    id: string
  ): Promise<{ id: string; readAt: number }>;
}
export interface ReplyNotificationSource {
  claim(): Promise<ReplyNotificationLease | null>;
  settle(id: string, token: string, failed: boolean): Promise<void>;
  resolve(
    recipientId: string,
    ids: string[]
  ): Promise<ReplyNotificationTarget[]>;
}

export class DeliverReplyNotifications {
  constructor(
    private readonly source: ReplyNotificationSource,
    private readonly store: ReplyInboxStore
  ) {}
  async advance(): Promise<boolean> {
    const lease = await this.source.claim();
    if (!lease) return false;
    try {
      const selected = await this.source.resolve(lease.event.recipientId, [
        lease.event.id,
      ]);
      if (
        selected.some(
          (item) =>
            item.id !== lease.event.id ||
            item.discussionId !== lease.event.discussionId
        ) ||
        selected.length > 1
      )
        throw new Error('Notification delivery scope differs');
      await this.store.receive(lease.event, selected.length === 1);
      await this.source.settle(lease.event.id, lease.token, false);
      return true;
    } catch (error) {
      // A lost acknowledgement may follow a committed inbox write; the exact receipt makes replay safe.
      await this.source.settle(lease.event.id, lease.token, true);
      throw error;
    }
  }
}

export class ReplyInboxService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: ReplyInboxStore,
    private readonly source: ReplyNotificationSource
  ) {}

  list(
    query: unknown,
    context: IdentityManagementContext
  ): Promise<Result<ReplyInboxPage, Error>> {
    return this.run('identity.notifications.read', context, async () => {
      let cursor: ReturnType<typeof replyInboxCursor>;
      try {
        cursor = replyInboxCursor(commentObject(query, ['cursor'])['cursor']);
      } catch {
        throw new CanonicalIdentityInputError('Invalid notification cursor');
      }
      const page = await this.store.list(context.identityId, cursor);
      if (!page.enabled) return { enabled: false, items: [], next: null };
      if (page.entries.length > 11)
        throw new Error('Notification page exceeds bounds');
      const scanned = page.entries.slice(0, 10),
        ids = scanned.map((row) => row.event.id);
      const targets = await this.source.resolve(context.identityId, ids);
      if (
        targets.length > ids.length ||
        new Set(targets.map((row) => row.id)).size !== targets.length ||
        targets.some((row) => !ids.includes(row.id))
      )
        throw new Error('Notification selection scope differs');
      const current = await this.store.current(context.identityId, ids);
      if (!current.enabled) return { enabled: false, items: [], next: null };
      if (current.revision !== page.revision)
        throw new CanonicalIdentityConflict(
          'Account preferences changed; refresh notifications'
        );
      const items = [];
      for (const candidate of scanned) {
        const row = current.entries.find(
          (entry) => entry.event.id === candidate.event.id
        );
        const target = targets.find((entry) => entry.id === candidate.event.id);
        if (!row || !target) continue;
        if (
          JSON.stringify(row.event) !== JSON.stringify(candidate.event) ||
          target.discussionId !== row.event.discussionId
        )
          throw new Error('Notification authority differs');
        items.push({ ...target, at: row.event.at, readAt: row.readAt });
      }
      const last = scanned[scanned.length - 1];
      return {
        enabled: true,
        items,
        next:
          page.entries.length > 10 ? `${last.event.at}.${last.event.id}` : null,
      };
    });
  }

  markRead(input: unknown, context: IdentityManagementContext) {
    return this.run('identity.notifications.update', context, () => {
      let id: string;
      try {
        id = publicCommentId(commentObject(input, ['id'])['id']);
      } catch {
        throw new CanonicalIdentityInputError('Invalid notification ID');
      }
      return this.store.markRead(context.identityId, id);
    });
  }

  private async run<T>(
    actionName: string,
    context: IdentityManagementContext,
    action: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      if (!isCanonicalIdentityId(context.identityId))
        throw new CanonicalIdentityAccessDenied('Authentication required');
      const decision = await this.authority.validate({
        ...context,
        actionName,
        timestamp: Date.now(),
        resource: { type: 'user', id: context.identityId },
      });
      if (!decision.ok)
        throw new CanonicalIdentityUnavailable(
          'Notification authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Notification access denied');
      return ok(await action());
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new CanonicalIdentityUnavailable('Notifications unavailable')
      );
    }
  }
}
