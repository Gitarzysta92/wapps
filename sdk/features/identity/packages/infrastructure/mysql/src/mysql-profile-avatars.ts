import { createHash, randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  isProfileAvatarId,
  parseProfileAvatarChange,
  PROFILE_AVATAR_DIMENSION,
  PROFILE_AVATAR_OUTPUT_LIMIT,
  type ProfileAvatarChange,
} from '@domains/customer/profiles';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import type {
  ProfileAvatarImage,
  ProfileAvatarStore,
} from '@sdk/features/identity/libs/management';
import {
  appendCanonicalIdentityEvent,
  assertActiveIdentity,
  canonicalSqlInteger,
  canonicalSqlRequired,
  readCanonicalIdentity,
} from './canonical-account-sql';

export class MysqlProfileAvatars implements ProfileAvatarStore {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now,
    private readonly id = randomUUID
  ) {}

  inspect(uid: string, input: ProfileAvatarChange, key: string) {
    const change = this.input(uid, input, key);
    return this.source.transaction(
      'REPEATABLE READ',
      async (manager) => (await this.check(manager, uid, change, key)).receipt
    );
  }

  change(
    uid: string,
    input: ProfileAvatarChange,
    key: string,
    image: ProfileAvatarImage | null
  ) {
    const change = this.input(uid, input, key);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const { current, receipt, fingerprint } = await this.check(
        manager,
        uid,
        change,
        key,
        true
      );
      if (receipt) return receipt;
      canonicalSqlRequired(
        (change.source === null) === (image === null),
        'Missing normalized avatar'
      );
      if (image) validateProfileAvatarImage(image);
      const revision = canonicalSqlInteger(current.revision + 1, 1);
      const at = Math.max(
        current.updatedAt,
        canonicalSqlInteger(this.now(), 1)
      );
      // One current immutable payload per account; old bytes disappear with the reference.
      await manager.query(
        'DELETE FROM identity_profile_avatars WHERE identityId = ?',
        [uid]
      );
      if (image)
        await manager.query(
          'INSERT INTO identity_profile_avatars (identityId, id, payload, sha256, width, height, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            uid,
            this.id(),
            Buffer.from(image.bytes),
            createHash('sha256').update(image.bytes).digest('hex'),
            image.width,
            image.height,
            at,
          ]
        );
      await manager.query(
        'UPDATE identity_accounts SET avatarUri = NULL, updatedAt = ? WHERE identityId = ?',
        [at, uid]
      );
      await manager.query(
        'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
        [revision, at, current.subjectId]
      );
      await manager.query(
        'INSERT INTO identity_account_commands (identityId, commandKey, fingerprint, revision, createdAt) VALUES (?, ?, ?, ?, ?)',
        [uid, key, fingerprint, revision, at]
      );
      await appendCanonicalIdentityEvent(
        manager,
        'identity.updated',
        { ...current, revision, updatedAt: at },
        at,
        this.id
      );
      return { identityId: uid, revision };
    });
  }

  read(uid: string, id: string): Promise<ProfileAvatarImage> {
    if (!isCanonicalIdentityId(uid))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    if (!isProfileAvatarId(id))
      throw new CanonicalIdentityInputError('Invalid photo ID');
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      assertActiveIdentity(await readCanonicalIdentity(manager, uid));
      const [row] = await manager.query<
        { payload: Buffer; width: unknown; height: unknown; sha256: string }[]
      >(
        'SELECT payload, width, height, sha256 FROM identity_profile_avatars WHERE identityId = ? AND id = ?',
        [uid, id]
      );
      if (!row) throw new CanonicalIdentityAccessDenied('Photo unavailable');
      const image = {
        bytes: row.payload,
        width: canonicalSqlInteger(row.width, 1),
        height: canonicalSqlInteger(row.height, 1),
      };
      validateProfileAvatarImage(image);
      canonicalSqlRequired(
        createHash('sha256').update(image.bytes).digest('hex') === row.sha256,
        'Corrupt stored photo'
      );
      return image;
    });
  }

  private input(uid: string, input: ProfileAvatarChange, key: string) {
    if (!isCanonicalIdentityId(uid))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    try {
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new Error();
      return parseProfileAvatarChange(input);
    } catch {
      throw new CanonicalIdentityInputError('Invalid photo command');
    }
  }

  private async check(
    manager: EntityManager,
    uid: string,
    input: ProfileAvatarChange,
    key: string,
    lock = false
  ) {
    const current = await readCanonicalIdentity(manager, uid, lock);
    assertActiveIdentity(current);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ operation: 'profile-avatar-v1', ...input }))
      .digest('hex');
    const [saved] = await manager.query<
      { fingerprint: string; revision: unknown }[]
    >(
      'SELECT fingerprint, revision FROM identity_account_commands WHERE identityId = ? AND commandKey = ?',
      [uid, key]
    );
    if (saved) {
      if (saved.fingerprint !== fingerprint)
        throw new CanonicalIdentityConflict(
          'Idempotency-Key belongs to another command'
        );
      const revision = canonicalSqlInteger(saved.revision, 2);
      canonicalSqlRequired(
        revision === input.expectedRevision + 1 && revision <= current.revision,
        'Invalid photo receipt'
      );
      return { current, fingerprint, receipt: { identityId: uid, revision } };
    }
    if (input.expectedRevision !== current.revision)
      throw new CanonicalIdentityConflict(
        'Profile changed. Reload before changing your photo.'
      );
    const [profile] = await manager.query<{ identityId: string }[]>(
      'SELECT identityId FROM identity_accounts WHERE identityId = ?',
      [uid]
    );
    if (!profile)
      throw new CanonicalIdentityInputError(
        'Save your profile details before adding a photo'
      );
    return { current, fingerprint, receipt: null };
  }
}

export function validateProfileAvatarImage(image: ProfileAvatarImage): void {
  canonicalSqlRequired(
    image.bytes instanceof Uint8Array &&
      image.bytes.byteLength >= 12 &&
      image.bytes.byteLength <= PROFILE_AVATAR_OUTPUT_LIMIT &&
      [image.width, image.height].every(
        (value) =>
          Number.isSafeInteger(value) &&
          value >= 1 &&
          value <= PROFILE_AVATAR_DIMENSION
      ),
    'Invalid normalized photo'
  );
  const bytes = Buffer.from(image.bytes);
  canonicalSqlRequired(
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP',
    'Invalid normalized photo format'
  );
}
