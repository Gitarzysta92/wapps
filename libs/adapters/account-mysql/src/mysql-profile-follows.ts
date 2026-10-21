import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  changeProfileFollow,
  parseProfileFollow,
  parseProfileFollowChange,
  PROFILE_FOLLOW_APPROVED_LIMIT,
  PROFILE_FOLLOW_DAILY_REQUEST_LIMIT,
  PROFILE_FOLLOW_OUTGOING_LIMIT,
  PROFILE_FOLLOW_PENDING_LIMIT,
  type ProfileFollow,
  type ProfileFollowChange,
} from '@domains/customer/profiles';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import type { ProfileFollowSnapshot } from '@wapps/account';
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
  profileVisibility,
  readProfileFollow,
} from './public-profile-sql';

export class MysqlProfileFollows {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now,
    private readonly id = randomUUID
  ) {}

  prepare(uid: string, input: ProfileFollowChange, key: string) {
    this.input(uid, input, key);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const prepared = await this.check(manager, uid, input, key, false);
      return prepared.receipt
        ? { receipt: prepared.receipt }
        : { snapshot: prepared.snapshot };
    });
  }

  change(
    uid: string,
    input: ProfileFollowChange,
    key: string,
    snapshot: ProfileFollowSnapshot,
    next: ProfileFollow
  ) {
    this.input(uid, input, key);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const checked = await this.check(manager, uid, input, key, true);
      if (checked.receipt) return checked.receipt;
      const { owner, requester, fingerprint } = checked;
      if (checked.snapshot.stamp !== snapshot.stamp)
        throw new CanonicalIdentityConflict(
          'Profile audience changed. Reload before continuing.'
        );
      const actorId = checked.snapshot.facts.viewerId;
      const requesterAction =
        input.action === 'request' || input.action === 'cancel';
      if (actorId !== (requesterAction ? requester.subjectId : owner.subjectId))
        throw new CanonicalIdentityAccessDenied('Follow action denied');
      if (
        input.action === 'request' &&
        (!checked.snapshot.facts.ownerActive ||
          checked.snapshot.facts.visibility !== 'followers')
      )
        throw new CanonicalIdentityAccessDenied(
          'This profile does not accept follow requests'
        );
      canonicalSqlRequired(
        profileStamp(
          changeProfileFollow(checked.snapshot.follow, input.action)
        ) === profileStamp(next),
        'Invalid follower transition'
      );
      const at = Math.max(
        owner.updatedAt,
        requester.updatedAt,
        canonicalSqlInteger(this.now(), 1)
      );
      if (input.action === 'request') {
        await this.limit(
          manager,
          'SELECT COUNT(*) AS count FROM identity_profile_follows WHERE requesterId = ? AND status <> ?',
          [requester.subjectId, 'none'],
          PROFILE_FOLLOW_OUTGOING_LIMIT,
          'Too many active follow requests'
        );
        await this.limit(
          manager,
          'SELECT COUNT(*) AS count FROM identity_profile_follows WHERE ownerId = ? AND status = ?',
          [owner.subjectId, 'pending'],
          PROFILE_FOLLOW_PENDING_LIMIT,
          'This profile has too many pending requests'
        );
        await this.limit(
          manager,
          'SELECT COUNT(*) AS count FROM identity_profile_follow_commands WHERE actorId = ? AND status = ? AND createdAt > ?',
          [requester.subjectId, 'pending', at - 86_400_000],
          PROFILE_FOLLOW_DAILY_REQUEST_LIMIT,
          'Daily follow request limit reached'
        );
      }
      if (input.action === 'approve')
        await this.limit(
          manager,
          'SELECT COUNT(*) AS count FROM identity_profile_follows WHERE ownerId = ? AND status = ?',
          [owner.subjectId, 'approved'],
          PROFILE_FOLLOW_APPROVED_LIMIT,
          'Approved follower limit reached'
        );
      await manager.query(
        'INSERT INTO identity_profile_follows (ownerId, requesterId, revision, status, updatedAt) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE revision = VALUES(revision), status = VALUES(status), updatedAt = VALUES(updatedAt)',
        [next.ownerId, next.requesterId, next.revision, next.status, at]
      );
      await manager.query(
        'INSERT INTO identity_profile_follow_commands (actorId, commandKey, ownerId, requesterId, fingerprint, revision, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          actorId,
          key,
          next.ownerId,
          next.requesterId,
          fingerprint,
          next.revision,
          next.status,
          at,
        ]
      );
      // Account invalidations and the pair's own revision commit with the exact historical receipt.
      for (const identity of [owner, requester]) {
        const revision = canonicalSqlInteger(identity.revision + 1, 1);
        await manager.query(
          'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
          [revision, at, identity.subjectId]
        );
        await appendCanonicalIdentityEvent(
          manager,
          'identity.updated',
          { ...identity, revision, updatedAt: at },
          at,
          this.id
        );
      }
      return next;
    });
  }

  private async check(
    manager: EntityManager,
    uid: string,
    input: ProfileFollowChange,
    key: string,
    lock: boolean
  ) {
    const actor = await readCanonicalIdentity(manager, uid);
    assertActiveIdentity(actor);
    if (![input.ownerId, input.requesterId].includes(actor.subjectId))
      throw new CanonicalIdentityAccessDenied('Follow action denied');
    // Every pair writer locks its two identities in this order, including concurrent opposite follows.
    const identities = [];
    for (const id of [input.ownerId, input.requesterId].sort())
      identities.push(await identityByPublicId(manager, id, lock));
    const owner = identities.find(
      (identity) => identity?.subjectId === input.ownerId
    );
    const requester = identities.find(
      (identity) => identity?.subjectId === input.requesterId
    );
    if (!owner || owner.isDeleted || !requester || requester.isDeleted)
      throw new CanonicalIdentityAccessDenied('Profile unavailable');
    assertActiveIdentity(
      actor.subjectId === owner.subjectId ? owner : requester
    );
    const profiles = await manager.query<{ identityId: string }[]>(
      'SELECT identityId FROM identity_accounts WHERE identityId IN (?, ?)',
      [owner.identityId, requester.identityId]
    );
    if (
      !profiles.some((profile) => profile.identityId === owner.identityId) ||
      !profiles.some((profile) => profile.identityId === requester.identityId)
    )
      throw new CanonicalIdentityInputError(
        'Both accounts must have saved profiles'
      );
    const follow = await readProfileFollow(
      manager,
      input.ownerId,
      input.requesterId
    );
    const fingerprint = profileStamp({
      operation: 'profile-follow-v1',
      ...input,
    });
    const [saved] = await manager.query<
      {
        fingerprint: string;
        ownerId: string;
        requesterId: string;
        revision: unknown;
        status: string;
      }[]
    >(
      'SELECT fingerprint, ownerId, requesterId, revision, status FROM identity_profile_follow_commands WHERE actorId = ? AND commandKey = ?',
      [actor.subjectId, key]
    );
    let receipt: ProfileFollow | null = null;
    if (saved) {
      if (saved.fingerprint !== fingerprint)
        throw new CanonicalIdentityConflict(
          'Idempotency-Key belongs to another follow command'
        );
      receipt = parseProfileFollow({
        ownerId: saved.ownerId,
        requesterId: saved.requesterId,
        revision: canonicalSqlInteger(saved.revision, 1),
        status: saved.status,
      });
      canonicalSqlRequired(
        receipt.ownerId === input.ownerId &&
          receipt.requesterId === input.requesterId &&
          receipt.revision === input.expectedRevision + 1 &&
          receipt.revision <= follow.revision &&
          receipt.status ===
            (input.action === 'request'
              ? 'pending'
              : input.action === 'approve'
              ? 'approved'
              : 'none'),
        'Invalid follower receipt'
      );
    } else if (follow.revision !== input.expectedRevision)
      throw new CanonicalIdentityConflict(
        'Follower revision changed. Reload before continuing.'
      );
    const facts = {
      ownerId: owner.subjectId,
      viewerId: actor.subjectId,
      visibility: await profileVisibility(manager, owner),
      ownerActive: owner.isActive && !owner.isSuspended,
      viewerActive: true,
      viewerRegistered: true,
      approved: follow.status === 'approved',
    };
    const snapshot = {
      facts,
      follow,
      stamp: profileStamp({
        owner: owner.revision,
        requester: requester.revision,
        facts,
        follow,
      }),
    };
    return { owner, requester, fingerprint, receipt, snapshot };
  }

  private input(uid: string, input: ProfileFollowChange, key: string) {
    if (!isCanonicalIdentityId(uid))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    try {
      parseProfileFollowChange(input);
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new Error();
    } catch {
      throw new CanonicalIdentityInputError('Invalid follower command');
    }
  }

  private async limit(
    manager: EntityManager,
    sql: string,
    values: unknown[],
    maximum: number,
    message: string
  ) {
    const [row] = await manager.query<{ count: unknown }[]>(sql, values);
    if (canonicalSqlInteger(row?.count) >= maximum)
      throw new CanonicalIdentityConflict(message);
  }
}
