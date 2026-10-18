import {
  consumerBindingKey,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';

import type { IdentityManagementContext } from './models/identity-management-context';

export interface NotificationEvent {
  id: string;
  recipientId: string;
  at: number;
}
export interface NotificationTarget {
  id: string;
}
export interface NotificationCursor {
  at: number;
  id: string;
}
export interface NotificationLease<Event> {
  event: Event;
  token: string;
  until: number;
}
export interface NotificationInboxPage<Target> {
  enabled: boolean;
  items: (Target & { at: number; readAt: number | null })[];
  next: string | null;
}
export interface NotificationBinding<Event, Target> {
  eventKey(event: Event): string;
  targetKey(target: Target): string;
  cursor(input: unknown): NotificationCursor | null;
  id(input: unknown): string;
}
function inboxFields(
  input: unknown,
  allowed: string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new CanonicalIdentityInputError('Invalid notification fields');
  return Object.fromEntries(Object.entries(input));
}

export interface NotificationInboxSnapshot<Event extends NotificationEvent> {
  revision: number;
  enabled: boolean;
  entries: { event: Event; readAt: number | null }[];
}
export interface NotificationInboxStore<Event extends NotificationEvent> {
  receive(event: Event, visible: boolean): Promise<'delivered' | 'suppressed'>;
  list(
    identityId: string,
    cursor: NotificationCursor | null
  ): Promise<NotificationInboxSnapshot<Event>>;
  current(
    identityId: string,
    ids: string[]
  ): Promise<NotificationInboxSnapshot<Event>>;
  markRead(
    identityId: string,
    id: string
  ): Promise<{ id: string; readAt: number }>;
}
export interface NotificationSource<
  Event extends NotificationEvent,
  Target extends NotificationTarget
> {
  claim(): Promise<NotificationLease<Event> | null>;
  settle(id: string, token: string, failed: boolean): Promise<void>;
  resolve(recipientId: string, ids: string[]): Promise<Target[]>;
}

export class DeliverNotifications<
  Event extends NotificationEvent,
  Target extends NotificationTarget
> {
  constructor(
    private readonly source: NotificationSource<Event, Target>,
    private readonly store: NotificationInboxStore<Event>,
    private readonly binding: NotificationBinding<Event, Target>
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
            consumerBindingKey(this.binding.targetKey(item)) !==
              consumerBindingKey(this.binding.eventKey(lease.event))
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

export class NotificationInboxService<
  Event extends NotificationEvent,
  Target extends NotificationTarget
> {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: NotificationInboxStore<Event>,
    private readonly source: NotificationSource<Event, Target>,
    private readonly binding: NotificationBinding<Event, Target>
  ) {}

  list(
    query: unknown,
    context: IdentityManagementContext
  ): Promise<Result<NotificationInboxPage<Target>, Error>> {
    return this.run('identity.notifications.read', context, async () => {
      let cursor: NotificationCursor | null;
      try {
        cursor = this.binding.cursor(inboxFields(query, ['cursor'])['cursor']);
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
          consumerBindingKey(this.binding.targetKey(target)) !==
            consumerBindingKey(this.binding.eventKey(row.event))
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
        id = this.binding.id(inboxFields(input, ['id'])['id']);
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
