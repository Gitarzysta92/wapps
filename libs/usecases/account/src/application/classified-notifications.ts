import {
  permitsContent,
  type ClassifiedContent,
} from '@domains/publication/classification';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
} from '@sdk/features/identity/core';
import type {
  NotificationSource,
  NotificationEvent,
  NotificationTarget,
} from '@sdk/features/identity/libs/management';
import type { AccountPreferencesStore } from './ports/account-preferences.port';

/** Recipient choices apply to both source delivery decisions and current inbox reads. */
export class ClassifiedNotifications<
  Event extends NotificationEvent,
  Target extends NotificationTarget & ClassifiedContent
> implements NotificationSource<Event, Target>
{
  constructor(
    private readonly source: NotificationSource<Event, Target>,
    private readonly preferences: Pick<
      AccountPreferencesStore,
      'getPreferences'
    >
  ) {}
  claim() {
    return this.source.claim();
  }
  settle(id: string, token: string, failed: boolean) {
    return this.source.settle(id, token, failed);
  }
  async resolve(recipient: string, ids: string[]) {
    const before = await this.recipientPreferences(recipient);
    if (!before) return [];
    const items = await this.source.resolve(recipient, ids);
    const after = await this.recipientPreferences(recipient);
    if (!after) return [];
    if (
      before.identityId !== recipient ||
      after.identityId !== recipient ||
      before.revision !== after.revision ||
      JSON.stringify(before.preferences) !== JSON.stringify(after.preferences)
    )
      throw new CanonicalIdentityConflict(
        'Content preferences changed; retry notifications'
      );
    return items.filter((item) =>
      permitsContent(item, after.preferences.content.showMatureContent)
    );
  }
  private async recipientPreferences(recipient: string) {
    try {
      return await this.preferences.getPreferences(recipient);
    } catch (error) {
      // Inactive/erased recipients must settle as suppressed, not poison source delivery.
      if (error instanceof CanonicalIdentityAccessDenied) return null;
      throw error;
    }
  }
}
