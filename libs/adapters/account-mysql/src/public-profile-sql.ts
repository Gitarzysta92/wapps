import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import {
  parseProfileFollow,
  parsePublicProfile,
  type ProfileFollow,
  type ProfileVisibility,
} from '@domains/customer/profiles';
import {
  defaultAccountPreferences,
  parseCustomerPreferences,
} from '@domains/customer/preferences';
import {
  CanonicalIdentityUnavailable,
  type CanonicalIdentityState,
} from '@sdk/features/identity/core';
import type { PublicProfileSnapshot } from '@wapps/account';
import {
  assertActiveIdentity,
  canonicalIdentityState,
  canonicalSqlInteger,
  canonicalSqlRequired,
  readCanonicalIdentity,
} from './canonical-account-sql';

export function profileStamp(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function identityByPublicId(
  manager: EntityManager,
  id: string,
  lock = false
): Promise<CanonicalIdentityState | null> {
  const [row] = await manager.query<Record<string, unknown>[]>(
    `SELECT id, identity_id, claim, kind, provider_type, is_active, is_suspended, is_deleted, revision, created_at, updated_at, deleted_at FROM identities WHERE id = ?${
      lock ? ' FOR UPDATE' : ''
    }`,
    [id]
  );
  if (!row) return null;
  const current = canonicalIdentityState(row);
  canonicalSqlRequired(
    current.subjectId === id,
    'Public identity lookup mismatch'
  );
  return current;
}

export async function profileVisibility(
  manager: EntityManager,
  owner: CanonicalIdentityState
): Promise<ProfileVisibility> {
  return (await profilePrivacy(manager, owner)).profileVisibility;
}

async function profilePrivacy(
  manager: EntityManager,
  owner: CanonicalIdentityState
) {
  const [row] = await manager.query<
    { preferences: unknown; updatedAt: unknown }[]
  >(
    'SELECT preferences, updatedAt FROM identity_preferences WHERE identityId = ?',
    [owner.identityId]
  );
  if (!row) return defaultAccountPreferences().privacy;
  canonicalSqlRequired(
    canonicalSqlInteger(row.updatedAt, 1) <= owner.updatedAt,
    'Invalid privacy timestamp'
  );
  try {
    return parseCustomerPreferences(
      typeof row.preferences === 'string'
        ? JSON.parse(row.preferences)
        : row.preferences
    ).privacy;
  } catch {
    throw new CanonicalIdentityUnavailable(
      'Invalid canonical privacy preferences'
    );
  }
}

export async function readProfileFollow(
  manager: EntityManager,
  ownerId: string,
  requesterId: string
): Promise<ProfileFollow> {
  const [row] = await manager.query<{ revision: unknown; status: unknown }[]>(
    'SELECT revision, status FROM identity_profile_follows WHERE ownerId = ? AND requesterId = ?',
    [ownerId, requesterId]
  );
  try {
    return parseProfileFollow({
      ownerId,
      requesterId,
      revision: row ? canonicalSqlInteger(row.revision, 1) : 0,
      status: row?.status ?? 'none',
    });
  } catch {
    throw new CanonicalIdentityUnavailable(
      'Invalid canonical follower relation'
    );
  }
}

export async function readPublicProfile(
  manager: EntityManager,
  id: string,
  viewer: string | null
): Promise<PublicProfileSnapshot | null> {
  const viewerState =
    viewer === null ? null : await readCanonicalIdentity(manager, viewer);
  if (viewer !== null) assertActiveIdentity(viewerState);
  const owner =
    viewerState?.subjectId === id
      ? viewerState
      : await identityByPublicId(manager, id);
  if (!owner || !owner.isActive || owner.isSuspended || owner.isDeleted)
    return null;
  const [row] = await manager.query<Record<string, unknown>[]>(
    'SELECT name, bio, location, contactEmail, socialLinks, registeredAt, updatedAt, (SELECT id FROM identity_profile_avatars WHERE identityId = identity_accounts.identityId) AS avatarId FROM identity_accounts WHERE identityId = ?',
    [owner.identityId]
  );
  if (!row) return null;
  canonicalSqlRequired(
    canonicalSqlInteger(row.updatedAt, 1) <= owner.updatedAt,
    'Invalid public profile timestamp'
  );
  let profile;
  const privacy = await profilePrivacy(manager, owner);
  try {
    profile = parsePublicProfile({
      id,
      name: row.name,
      bio: row.bio,
      location: row.location,
      contactEmail: privacy.showEmail ? row.contactEmail : null,
      socialLinks:
        row.socialLinks === null
          ? {}
          : typeof row.socialLinks === 'string'
          ? JSON.parse(row.socialLinks)
          : row.socialLinks,
      avatarId: row.avatarId ?? null,
      registeredAt: canonicalSqlInteger(row.registeredAt, 1),
    });
  } catch {
    throw new CanonicalIdentityUnavailable('Invalid canonical public profile');
  }
  const visibility = privacy.profileVisibility;
  const follow =
    viewerState && viewerState.subjectId !== id
      ? await readProfileFollow(manager, id, viewerState.subjectId)
      : null;
  const [viewerProfile] = viewerState
    ? await manager.query<{ identityId: string }[]>(
        'SELECT identityId FROM identity_accounts WHERE identityId = ?',
        [viewerState.identityId]
      )
    : [];
  const facts = {
    ownerId: id,
    viewerId: viewerState?.subjectId ?? null,
    visibility,
    ownerActive: true,
    viewerActive: viewer === null || viewerState !== null,
    viewerRegistered: !!viewerProfile,
    approved: follow?.status === 'approved',
    favoritesShared: privacy.showFavorites,
    suitesShared: privacy.showSuites,
    discussionsShared: privacy.showDiscussions,
    activityShared: privacy.showActivityHistory,
    badgesShared: privacy.showBadges,
  };
  return {
    profile,
    facts,
    follow,
    stamp: profileStamp({
      owner: owner.revision,
      viewer: viewerState?.revision ?? null,
      facts,
      follow,
      profile,
    }),
  };
}
