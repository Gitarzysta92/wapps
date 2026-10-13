import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  ACCOUNT_FAVORITES_LIMIT,
  parseFavoriteTarget,
} from '@domains/customer/favorites';
import {
  isPublicProfileId,
  parseProfileFollowerList,
  parseProfileFollowingList,
  PROFILE_DIRECTORY_PAGE_SIZE,
  PROFILE_FOLLOW_PAGE_SIZE,
  type ProfileFollowChange,
} from '@domains/customer/profiles';
import {
  CanonicalIdentityInputError,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import {
  PublicProfileNotFound,
  type PublicProfileSnapshot,
  type PublicProfileStore,
  type PublicProfileFavoritesStore,
  type PublicProfileContentOwnerStore,
} from '@sdk/features/identity/libs/management';
import {
  assertActiveIdentity,
  canonicalSqlInteger,
  canonicalSqlRequired,
  readCanonicalIdentity,
} from './canonical-account-sql';
import { readPublicProfile } from './public-profile-sql';
import { MysqlProfileFollows } from './mysql-profile-follows';
import { validateProfileAvatarImage } from './mysql-profile-avatars';

export class MysqlPublicProfiles
  implements
    PublicProfileStore,
    PublicProfileFavoritesStore,
    PublicProfileContentOwnerStore
{
  private readonly follows: MysqlProfileFollows;
  constructor(private readonly source: DataSource, now = Date.now) {
    this.follows = new MysqlProfileFollows(source, now);
  }

  inspect(id: string, viewer: string | null) {
    this.input(id, viewer);
    return this.source.transaction('REPEATABLE READ', (manager) =>
      readPublicProfile(manager, id, viewer)
    );
  }

  async confirm(snapshot: PublicProfileSnapshot, viewer: string | null) {
    const current = await this.inspect(snapshot.profile.id, viewer);
    return current?.stamp === snapshot.stamp ? current : null;
  }

  profileFavorites(snapshot: PublicProfileSnapshot, viewer: string | null) {
    return this.savedFavorites(snapshot, viewer, false).then((items) =>
      items.map(({ kind, id }) => ({ kind, id }))
    );
  }

  activityFavorites(snapshot: PublicProfileSnapshot, viewer: string | null) {
    return this.savedFavorites(snapshot, viewer, true);
  }

  private savedFavorites(snapshot: PublicProfileSnapshot, viewer: string | null, activity: boolean) {
    this.input(snapshot.profile.id, viewer);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await readPublicProfile(
        manager,
        snapshot.profile.id,
        viewer
      );
      if (
        !current ||
        current.stamp !== snapshot.stamp ||
        !current.facts.favoritesShared ||
        (activity && !current.facts.activityShared)
      )
        throw new PublicProfileNotFound();
      const rows = await manager.query<
        {
          targetKind: unknown;
          targetId: unknown;
          addedAt: unknown;
          accountUpdatedAt: unknown;
        }[]
      >(
        'SELECT f.targetKind, f.targetId, f.addedAt, i.updated_at AS accountUpdatedAt FROM identities i JOIN identity_favorites f ON f.identityId = i.claim WHERE i.id = ? ORDER BY f.targetKind, f.targetId LIMIT ?',
        [snapshot.profile.id, ACCOUNT_FAVORITES_LIMIT + 1]
      );
      canonicalSqlRequired(
        rows.length <= ACCOUNT_FAVORITES_LIMIT,
        'Invalid saved favorites capacity'
      );
      return rows.map((row) => {
        canonicalSqlRequired(
          canonicalSqlInteger(row.addedAt, 1) <=
            canonicalSqlInteger(row.accountUpdatedAt, 1),
          'Invalid saved favorite timestamp'
        );
        return { ...parseFavoriteTarget({ kind: row.targetKind, id: row.targetId }), addedAt: canonicalSqlInteger(row.addedAt, 1) };
      });
    });
  }

  contentOwner(snapshot: PublicProfileSnapshot, viewer: string | null) {
    this.input(snapshot.profile.id, viewer);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await readPublicProfile(
        manager,
        snapshot.profile.id,
        viewer
      );
      if (!current || current.stamp !== snapshot.stamp)
        throw new PublicProfileNotFound();
      const [owner] = await manager.query<{ claim: unknown }[]>(
        'SELECT claim FROM identities WHERE id = ?',
        [snapshot.profile.id]
      );
      if (!isCanonicalIdentityId(owner?.claim))
        throw new PublicProfileNotFound();
      return owner.claim;
    });
  }

  avatar(snapshot: PublicProfileSnapshot, viewer: string | null, id: string) {
    this.input(snapshot.profile.id, viewer);
    if (!isPublicProfileId(id))
      throw new CanonicalIdentityInputError('Invalid photo ID');
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await readPublicProfile(
        manager,
        snapshot.profile.id,
        viewer
      );
      if (
        !current ||
        current.stamp !== snapshot.stamp ||
        current.profile.avatarId !== id
      )
        throw new PublicProfileNotFound();
      const [row] = await manager.query<
        { payload: Buffer; sha256: string; width: unknown; height: unknown }[]
      >(
        'SELECT a.payload, a.sha256, a.width, a.height FROM identity_profile_avatars a JOIN identities i ON i.claim = a.identityId WHERE i.id = ? AND a.id = ?',
        [snapshot.profile.id, id]
      );
      canonicalSqlRequired(row, 'Missing canonical photo');
      const image = {
        bytes: row.payload,
        width: canonicalSqlInteger(row.width, 1),
        height: canonicalSqlInteger(row.height, 1),
      };
      validateProfileAvatarImage(image);
      canonicalSqlRequired(
        createHash('sha256').update(image.bytes).digest('hex') === row.sha256,
        'Corrupt public photo'
      );
      return image;
    });
  }

  directory(after: string | null, viewer: string | null) {
    if (after !== null) this.input(after, viewer);
    else this.viewer(viewer);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      if (viewer !== null)
        assertActiveIdentity(await readCanonicalIdentity(manager, viewer));
      const rows = await manager.query<{ id: string }[]>(
        `SELECT i.id FROM identities i JOIN identity_accounts a ON a.identityId = i.claim JOIN identity_preferences p ON p.identityId = i.claim WHERE i.is_active = 1 AND i.is_suspended = 0 AND i.is_deleted = 0 AND JSON_UNQUOTE(JSON_EXTRACT(p.preferences, '$.privacy.profileVisibility')) = 'public' AND (? IS NULL OR i.id > ?) ORDER BY i.id LIMIT ?`,
        [after, after, PROFILE_DIRECTORY_PAGE_SIZE + 1]
      );
      const snapshots: PublicProfileSnapshot[] = [];
      for (const row of rows.slice(0, PROFILE_DIRECTORY_PAGE_SIZE)) {
        const snapshot = await readPublicProfile(manager, row.id, viewer);
        canonicalSqlRequired(
          snapshot && snapshot.facts.visibility === 'public',
          'Inconsistent public directory'
        );
        snapshots.push(snapshot);
      }
      return {
        snapshots,
        after:
          rows.length > PROFILE_DIRECTORY_PAGE_SIZE
            ? snapshots[snapshots.length - 1].profile.id
            : null,
      };
    });
  }

  followers(uid: string, after: string | null) {
    this.viewer(uid);
    if (after !== null && !isPublicProfileId(after))
      throw new CanonicalIdentityInputError('Invalid follower cursor');
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const owner = await readCanonicalIdentity(manager, uid);
      assertActiveIdentity(owner);
      const rows = await manager.query<
        {
          ownerId: string;
          requesterId: string;
          revision: unknown;
          status: string;
          requesterName: string;
        }[]
      >(
        'SELECT f.ownerId, f.requesterId, f.revision, f.status, a.name AS requesterName FROM identity_profile_follows f JOIN identities i ON i.id = f.requesterId JOIN identity_accounts a ON a.identityId = i.claim WHERE f.ownerId = ? AND f.status IN (?, ?) AND i.is_active = 1 AND i.is_suspended = 0 AND i.is_deleted = 0 AND (? IS NULL OR f.requesterId > ?) ORDER BY f.requesterId LIMIT ?',
        [
          owner.subjectId,
          'pending',
          'approved',
          after,
          after,
          PROFILE_FOLLOW_PAGE_SIZE + 1,
        ]
      );
      return parseProfileFollowerList({
        followers: rows.slice(0, PROFILE_FOLLOW_PAGE_SIZE).map((row) => ({
          ...row,
          revision: canonicalSqlInteger(row.revision, 1),
        })),
        after:
          rows.length > PROFILE_FOLLOW_PAGE_SIZE
            ? rows[PROFILE_FOLLOW_PAGE_SIZE - 1].requesterId
            : null,
      });
    });
  }

  prepareFollow(uid: string, input: ProfileFollowChange, key: string) {
    return this.follows.prepare(uid, input, key);
  }
  changeFollow(...args: Parameters<PublicProfileStore['changeFollow']>) {
    return this.follows.change(...args);
  }

  following(uid: string, after: string | null) {
    this.viewer(uid);
    if (after !== null && !isPublicProfileId(after))
      throw new CanonicalIdentityInputError('Invalid following cursor');
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const requester = await readCanonicalIdentity(manager, uid);
      assertActiveIdentity(requester);
      const rows = await manager.query<
        {
          ownerId: string;
          requesterId: string;
          revision: unknown;
          status: string;
        }[]
      >(
        'SELECT ownerId, requesterId, revision, status FROM identity_profile_follows WHERE requesterId = ? AND status IN (?, ?) AND (? IS NULL OR ownerId > ?) ORDER BY ownerId LIMIT ?',
        [
          requester.subjectId,
          'pending',
          'approved',
          after,
          after,
          PROFILE_FOLLOW_PAGE_SIZE + 1,
        ]
      );
      return parseProfileFollowingList({
        following: rows.slice(0, PROFILE_FOLLOW_PAGE_SIZE).map((row) => ({
          ...row,
          revision: canonicalSqlInteger(row.revision, 1),
        })),
        after:
          rows.length > PROFILE_FOLLOW_PAGE_SIZE
            ? rows[PROFILE_FOLLOW_PAGE_SIZE - 1].ownerId
            : null,
      });
    });
  }

  private viewer(viewer: string | null) {
    if (viewer !== null && !isCanonicalIdentityId(viewer))
      throw new CanonicalIdentityInputError('Invalid profile viewer');
  }
  private input(id: string, viewer: string | null) {
    if (!isPublicProfileId(id))
      throw new CanonicalIdentityInputError('Invalid public profile ID');
    this.viewer(viewer);
  }
}
