import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  changeProfileBadge,
  parseProfileBadgeAdministration,
  parseProfileBadgeEvent,
  parseProfileBadgeSnapshot,
  parseSharedProfileBadges,
  PROFILE_BADGE_HISTORY_SIZE,
  type ProfileBadgeChange,
  type ProfileBadgeEvent,
} from '@domains/customer/profiles';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
} from '@sdk/features/identity/core';
import {
  PublicProfileNotFound,
  type ProfileBadgesStore,
  type PublicProfileSnapshot,
} from '@wapps/account';
import {
  appendCanonicalIdentityEvent,
  assertActiveIdentity,
  canonicalSqlInteger,
  canonicalSqlRequired,
  readCanonicalIdentity,
} from './canonical-account-sql';
import {
  identityByPublicId,
  profileStamp,
  readPublicProfile,
} from './public-profile-sql';

export function badgeFingerprint(
  profileId: string,
  command: ProfileBadgeChange
): string {
  return profileStamp({ operation: 'profile-badge-v1', profileId, ...command });
}
export function badgeEventFromSql(
  row: Record<string, unknown>
): ProfileBadgeEvent {
  return parseProfileBadgeEvent({
    profileId: row.ownerId,
    revision: canonicalSqlInteger(row.revision, 1),
    kind: row.kind,
    action: row.action,
    reason: row.reason,
    actorId: row.actorId,
    at: canonicalSqlInteger(row.createdAt, 1),
  });
}
export async function readBadgeSnapshot(
  manager: Pick<EntityManager, 'query'>,
  profileId: string
) {
  const [latest] = await manager.query<{ revision: unknown }[]>(
    'SELECT MAX(revision) AS revision FROM identity_profile_badge_events WHERE ownerId = ?',
    [profileId]
  );
  const rows = await manager.query<Record<string, unknown>[]>(
    'SELECT kind, revision, active, awardedAt, updatedAt FROM identity_profile_badges WHERE ownerId = ? ORDER BY kind LIMIT 3',
    [profileId]
  );
  return parseProfileBadgeSnapshot({
    profileId,
    revision:
      latest?.revision === null ? 0 : canonicalSqlInteger(latest?.revision),
    badges: rows.map((row) => {
      const active = canonicalSqlInteger(row.active);
      canonicalSqlRequired(active === 0 || active === 1, 'Invalid badge state');
      return {
        kind: row.kind,
        revision: canonicalSqlInteger(row.revision, 1),
        active: active === 1,
        awardedAt: canonicalSqlInteger(row.awardedAt, 1),
        updatedAt: canonicalSqlInteger(row.updatedAt, 1),
      };
    }),
  });
}

export class MysqlProfileBadges implements ProfileBadgesStore {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now,
    private readonly eventId = randomUUID
  ) {}

  async assertStaffIdentity(uid: string) {
    await this.source.transaction('REPEATABLE READ', async (manager) => {
      assertActiveIdentity(await readCanonicalIdentity(manager, uid));
    });
  }
  administer(uid: string, profileId: string, after: number | null) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      assertActiveIdentity(await readCanonicalIdentity(manager, uid));
      const owner = await identityByPublicId(manager, profileId);
      if (!owner || owner.isDeleted) throw new PublicProfileNotFound();
      const [profile] = await manager.query<{ name: unknown }[]>(
        'SELECT name FROM identity_accounts WHERE identityId = ?',
        [owner.identityId]
      );
      if (!profile) throw new PublicProfileNotFound();
      const snapshot = await readBadgeSnapshot(manager, profileId);
      const events = await manager.query<Record<string, unknown>[]>(
        'SELECT * FROM identity_profile_badge_events WHERE ownerId = ? AND (? IS NULL OR revision < ?) ORDER BY revision DESC LIMIT ?',
        [profileId, after, after, PROFILE_BADGE_HISTORY_SIZE + 1]
      );
      const page = events
        .slice(0, PROFILE_BADGE_HISTORY_SIZE)
        .map(badgeEventFromSql);
      return parseProfileBadgeAdministration({
        ...snapshot,
        name: profile.name,
        active: owner.isActive && !owner.isSuspended,
        events: page,
        after:
          events.length > PROFILE_BADGE_HISTORY_SIZE
            ? page[page.length - 1].revision
            : null,
      });
    });
  }
  change(
    uid: string,
    profileId: string,
    command: ProfileBadgeChange,
    key: string
  ) {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const actor = await readCanonicalIdentity(manager, uid);
      assertActiveIdentity(actor);
      // Lock actor and recipient in public-ID order, shared with follower writers.
      const locked = [];
      for (const id of [...new Set([profileId, actor.subjectId])].sort())
        locked.push(await identityByPublicId(manager, id, true));
      const currentActor =
        locked.find((identity) => identity?.subjectId === actor.subjectId) ??
        null;
      assertActiveIdentity(currentActor);
      const owner = locked.find(
        (identity) => identity?.subjectId === profileId
      );
      if (!owner || owner.isDeleted) throw new PublicProfileNotFound();
      if (command.action === 'award' && (!owner.isActive || owner.isSuspended))
        throw new CanonicalIdentityAccessDenied(
          'An inactive profile cannot receive a badge'
        );
      const [profile] = await manager.query<unknown[]>(
        'SELECT identityId FROM identity_accounts WHERE identityId = ?',
        [owner.identityId]
      );
      if (!profile) throw new PublicProfileNotFound();
      const fingerprint = badgeFingerprint(profileId, command);
      const [receipt] = await manager.query<Record<string, unknown>[]>(
        'SELECT * FROM identity_profile_badge_events WHERE actorId = ? AND commandKey = ?',
        [actor.subjectId, key]
      );
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new CanonicalIdentityConflict(
            'Idempotency-Key belongs to another badge command'
          );
        return badgeEventFromSql(receipt);
      }
      const current = await readBadgeSnapshot(manager, profileId);
      const at = Math.max(
        owner.updatedAt,
        currentActor.updatedAt,
        canonicalSqlInteger(this.now(), 1)
      );
      const next = changeProfileBadge(current, command, at);
      const badge = next.badges.find((badge) => badge.kind === command.kind);
      canonicalSqlRequired(badge, 'Missing badge transition');
      const event = parseProfileBadgeEvent({
        profileId,
        revision: next.revision,
        kind: command.kind,
        action: command.action,
        reason: command.reason,
        actorId: actor.subjectId,
        at,
      });
      await manager.query(
        'INSERT INTO identity_profile_badges (ownerId, kind, revision, active, awardedAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE revision = VALUES(revision), active = VALUES(active), awardedAt = VALUES(awardedAt), updatedAt = VALUES(updatedAt)',
        [
          profileId,
          badge.kind,
          badge.revision,
          badge.active ? 1 : 0,
          badge.awardedAt,
          badge.updatedAt,
        ]
      );
      await manager.query(
        'INSERT INTO identity_profile_badge_events (ownerId, revision, kind, action, reason, actorId, commandKey, fingerprint, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          profileId,
          event.revision,
          event.kind,
          event.action,
          event.reason,
          event.actorId,
          key,
          fingerprint,
          at,
        ]
      );
      const revision = canonicalSqlInteger(owner.revision + 1, 1);
      await manager.query(
        'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
        [revision, at, profileId]
      );
      await appendCanonicalIdentityEvent(
        manager,
        'identity.updated',
        { ...owner, revision, updatedAt: at },
        at,
        this.eventId
      );
      return event;
    });
  }
  own(uid: string) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const owner = await readCanonicalIdentity(manager, uid);
      assertActiveIdentity(owner);
      return this.active(manager, owner.subjectId);
    });
  }
  shared(snapshot: PublicProfileSnapshot, viewer: string | null) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await readPublicProfile(
        manager,
        snapshot.profile.id,
        viewer
      );
      if (
        !current ||
        current.stamp !== snapshot.stamp ||
        !current.facts.badgesShared
      )
        throw new PublicProfileNotFound();
      return this.active(manager, snapshot.profile.id);
    });
  }
  private async active(manager: EntityManager, id: string) {
    const current = await readBadgeSnapshot(manager, id);
    return parseSharedProfileBadges({
      sharing: 'visible',
      items: current.badges
        .filter((badge) => badge.active)
        .map(({ kind, awardedAt }) => ({ kind, awardedAt })),
    });
  }
}
