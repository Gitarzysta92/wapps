import { createHash, randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  defaultAccountPreferences,
  parseAccountPreferences,
  parsePreferencesUpdate,
  type AccountPreferences,
  type PreferencesUpdate,
  type PreferencesUpdateReceipt,
} from '@domains/customer/preferences';
import {
  parsePrivateProfile,
  parseProfileUpdate,
  type PrivateProfile,
  type ProfileUpdate,
  type ProfileUpdateReceipt,
} from '@domains/customer/profiles';
import type { InitialAccountEnrollment } from '@sdk/features/identity/libs/authentication';
import {
  CredentialIdentityBindings,
  CredentialSubject,
  credentialSubject,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityDeletion,
  CanonicalIdentityState,
  CanonicalIdentityStore,
  isCanonicalIdentityId,
  CanonicalIdentityConflict,
  CanonicalIdentityUnavailable,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import type {
  AccountRegistration,
  AccountRegistrationReceipt,
  AccountState,
  AccountStateStore,
} from '@sdk/features/identity/libs/management';
import type {
  PrivateProfileStore,
  AccountPreferencesStore,
} from '@wapps/account';

import {
  canonicalSqlRequired as required,
  canonicalSqlInteger as integer,
  readCanonicalIdentity,
  assertActiveIdentity,
  appendCanonicalIdentityEvent,
} from './canonical-account-sql';
export { canonicalIdentityState } from './canonical-account-sql';

/** Canonical Identity persistence; credential processes never access this store. */
export class MysqlCanonicalIdentities
  implements
    CanonicalIdentityStore,
    CredentialIdentityBindings,
    AccountStateStore,
    PrivateProfileStore,
    AccountPreferencesStore,
    InitialAccountEnrollment
{
  constructor(
    private readonly source: DataSource,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID
  ) {}

  async find(uid: string): Promise<CanonicalIdentityState | null> {
    this.uid(uid);
    return this.read(this.source.manager, uid);
  }

  async ensure(input: {
    uid: string;
    provider: string;
    kind: string;
    activate: boolean;
  }): Promise<{ state: CanonicalIdentityState; created: boolean }> {
    this.uid(input.uid);
    required(
      typeof input.provider === 'string' &&
        /^[a-z][a-z0-9_-]{0,63}$/.test(input.provider) &&
        ['user', 'guest'].includes(input.kind) &&
        typeof input.activate === 'boolean',
      'Invalid identity provision input'
    );
    try {
      return await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          const existing = await this.read(manager, input.uid, true);
          if (existing) return { state: existing, created: false };
          const created = await this.createIdentity(
            manager,
            input.uid,
            input.provider,
            input.kind,
            input.activate
          );
          return { state: created, created: true };
        }
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        const existing = await this.find(input.uid);
        if (existing) return { state: existing, created: false };
      }
      throw error;
    }
  }

  private async createIdentity(
    manager: EntityManager,
    uid: string,
    provider: string,
    kind: string,
    activate: boolean
  ): Promise<CanonicalIdentityState> {
    const at = integer(this.now(), 1);
    const created: CanonicalIdentityState = {
      identityId: uid,
      subjectId: this.id(),
      provider: provider,
      kind: kind,
      isActive: activate,
      isSuspended: false,
      isDeleted: false,
      revision: 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: 0,
    };
    await manager.query(
      `INSERT INTO identities (id, identity_id, claim, kind, provider_type, provider_secret, is_active, is_suspended, is_deleted, created_at, updated_at, deleted_at, revision) VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 0, ?, ?, 0, 1)`,
      [created.subjectId, uid, uid, kind, provider, activate, at, at]
    );
    await this.event(manager, 'identity.created', created, at);
    return created;
  }

  async findCredential(
    input: CredentialSubject
  ): Promise<CanonicalIdentityState | null> {
    const { issuer, subject } = credentialSubject(input);
    const rows: { identityId: string }[] = await this.source.query(
      'SELECT identityId FROM identity_credential_bindings WHERE issuer = ? AND subject = ?',
      [issuer, subject]
    );
    if (!rows.length) return null;
    const state = await this.find(rows[0].identityId);
    if (!state)
      throw new CanonicalIdentityUnavailable(
        'Credential binding has no identity'
      );
    return state;
  }

  async credentialSubjects(identityId: string): Promise<CredentialSubject[]> {
    this.uid(identityId);
    const rows: CredentialSubject[] = await this.source.query(
      'SELECT CONVERT(issuer USING utf8mb4) AS issuer, CONVERT(subject USING utf8mb4) AS subject FROM identity_credential_bindings WHERE identityId = ? ORDER BY issuer, subject LIMIT 65',
      [identityId]
    );
    if (!rows.length || rows.length > 64)
      throw new CanonicalIdentityUnavailable(
        'Verified credential bindings required'
      );
    return rows.map(credentialSubject);
  }

  async enrollCredential(
    input: CredentialSubject,
    eligible: boolean
  ): Promise<CanonicalIdentityState> {
    const { issuer, subject } = credentialSubject(input);
    try {
      return await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          const rows: { identityId: string }[] = await manager.query(
            'SELECT identityId FROM identity_credential_bindings WHERE issuer = ? AND subject = ? FOR UPDATE',
            [issuer, subject]
          );
          if (rows.length) {
            const state = await this.read(manager, rows[0].identityId, true);
            if (!state)
              throw new CanonicalIdentityUnavailable(
                'Credential binding has no identity'
              );
            return state;
          }
          if (eligible !== true)
            throw new CanonicalIdentityAccessDenied(
              'Verified enrollment or explicit credential migration required'
            );
          const identityId = this.id();
          const state = await this.createIdentity(
            manager,
            identityId,
            'credentials',
            'user',
            true
          );
          await manager.query(
            'INSERT INTO identity_credential_bindings (issuer, subject, identityId, createdAt) VALUES (?, ?, ?, ?)',
            [issuer, subject, identityId, state.createdAt]
          );
          return state;
        }
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        const state = await this.findCredential(input);
        if (state) return state;
      }
      throw error;
    }
  }

  async recordAuthentication(uid: string, provider: string): Promise<void> {
    this.uid(uid);
    required(
      /^[a-z][a-z0-9_-]{0,63}$/.test(provider),
      'Invalid authentication provider'
    );
    await this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid, true);
      if (
        !current ||
        !current.isActive ||
        current.isSuspended ||
        current.isDeleted
      )
        throw new CanonicalIdentityConflict('Identity is unavailable');
      await this.event(
        manager,
        'identity.authenticated',
        current,
        integer(this.now(), 1),
        provider
      );
    });
  }

  async setSuspended(
    uid: string,
    suspended: boolean
  ): Promise<CanonicalIdentityState> {
    this.uid(uid);
    if (typeof suspended !== 'boolean')
      throw new CanonicalIdentityInputError('Invalid suspension flag');
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid, true);
      if (!current || current.isDeleted)
        throw new CanonicalIdentityConflict('Identity is unavailable');
      if (current.isSuspended === suspended) return current;
      const next = {
        ...current,
        isSuspended: suspended,
        revision: integer(current.revision + 1, 1),
        updatedAt: Math.max(current.updatedAt, integer(this.now(), 1)),
      };
      await manager.query(
        'UPDATE identities SET is_suspended = ?, revision = ?, updated_at = ? WHERE id = ?',
        [suspended, next.revision, next.updatedAt, current.subjectId]
      );
      await this.event(manager, 'identity.updated', next, next.updatedAt);
      return next;
    });
  }

  async findDeletion(uid: string): Promise<CanonicalIdentityDeletion | null> {
    this.uid(uid);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid);
      if (!current || !current.isDeleted) return null;
      const deletion = await this.deletionState(manager, current);
      if (!deletion)
        throw new CanonicalIdentityUnavailable('Deletion journal unavailable');
      return deletion;
    });
  }

  private async deletionState(
    manager: EntityManager,
    current: CanonicalIdentityState
  ): Promise<CanonicalIdentityDeletion | null> {
    const uid = current.identityId;
    const [job] = await manager.query<
      {
        revision: unknown;
        completedAt: unknown;
        failedAt: unknown;
        erasureRevision: unknown;
        erasureCompletedAt: unknown;
        erasureFailedAt: unknown;
      }[]
    >(
      'SELECT d.revision, d.completedAt, d.failedAt, e.revision AS erasureRevision, e.completedAt AS erasureCompletedAt, e.failedAt AS erasureFailedAt FROM identity_deletion_jobs d LEFT JOIN identity_erasure_jobs e ON e.identityId = d.identityId WHERE d.identityId = ?',
      [uid]
    );
    if (job) {
      required(
        integer(job.revision, 1) === current.revision &&
          integer(job.erasureRevision, 1) === current.revision &&
          !(job.completedAt !== null && job.failedAt !== null) &&
          !(job.erasureCompletedAt !== null && job.erasureFailedAt !== null),
        'Invalid deletion journal state'
      );
      if (job.completedAt !== null) integer(job.completedAt, 1);
      if (job.failedAt !== null) integer(job.failedAt, 1);
      if (job.erasureCompletedAt !== null) integer(job.erasureCompletedAt, 1);
      if (job.erasureFailedAt !== null) integer(job.erasureFailedAt, 1);
      return {
        ...current,
        cleanup:
          job.completedAt !== null && job.erasureCompletedAt !== null
            ? 'completed'
            : job.failedAt !== null || job.erasureFailedAt !== null
            ? 'failed'
            : 'pending',
      };
    }
    return null;
  }

  async requestDeletion(uid: string): Promise<CanonicalIdentityDeletion> {
    this.uid(uid);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid, true);
      if (!current)
        throw new CanonicalIdentityConflict('Identity is unavailable');
      if (current.isDeleted) {
        const deletion = await this.deletionState(manager, current);
        if (deletion) return deletion;
        // A compatible pre-outbox tombstone can request cleanup without changing identity history.
        const at = Math.max(current.updatedAt, integer(this.now(), 1));
        await manager.query(
          'INSERT INTO identity_deletion_jobs (identityId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?)',
          [uid, current.revision, at, at]
        );
        await manager.query(
          'INSERT INTO identity_erasure_jobs (identityId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE identityId = identityId',
          [uid, current.revision, at, at]
        );
        await this.event(manager, 'identity.deleted', current, at);
        return { ...current, cleanup: 'pending' };
      }
      const at = Math.max(current.updatedAt, integer(this.now(), 1));
      const next = {
        ...current,
        isActive: false,
        isDeleted: true,
        revision: integer(current.revision + 1, 1),
        updatedAt: at,
        deletedAt: at,
      };
      await manager.query(
        'UPDATE identities SET is_active = 0, is_deleted = 1, revision = ?, updated_at = ?, deleted_at = ? WHERE id = ?',
        [next.revision, at, at, current.subjectId]
      );
      await manager.query(
        'DELETE FROM identity_profile_avatars WHERE identityId = ?',
        [uid]
      );
      await manager.query(
        'DELETE FROM identity_profile_follow_commands WHERE ownerId = ? OR requesterId = ?',
        [current.subjectId, current.subjectId]
      );
      await manager.query(
        'DELETE FROM identity_profile_follows WHERE ownerId = ? OR requesterId = ?',
        [current.subjectId, current.subjectId]
      );
      await manager.query(
        'DELETE FROM identity_accounts WHERE identityId = ?',
        [uid]
      );
      await manager.query(
        'DELETE FROM identity_preferences WHERE identityId = ?',
        [uid]
      );
      await manager.query(
        'DELETE FROM identity_favorite_watches WHERE identityId=?',
        [uid]
      );
      await manager.query(
        'DELETE FROM identity_favorites WHERE identityId = ?',
        [uid]
      );
      await manager.query(
        'INSERT INTO identity_deletion_jobs (identityId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?)',
        [uid, next.revision, at, at]
      );
      await manager.query(
        'INSERT INTO identity_erasure_jobs (identityId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?)',
        [uid, next.revision, at, at]
      );
      await this.event(manager, 'identity.deleted', next, at);
      return { ...next, cleanup: 'pending' };
    });
  }

  async account(uid: string): Promise<AccountState> {
    this.uid(uid);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await this.read(manager, uid);
      this.active(current);
      const [row] = await manager.query<Record<string, unknown>[]>(
        'SELECT name, bio, location, avatarUri, registeredAt, updatedAt FROM identity_accounts WHERE identityId = ?',
        [uid]
      );
      return {
        identityId: uid,
        subjectId: current.subjectId,
        revision: current.revision,
        status: row ? 'ACTIVE' : 'STUB',
        createdAt: current.createdAt,
        updatedAt: row ? integer(row.updatedAt, 1) : current.updatedAt,
        registeredAt: row ? integer(row.registeredAt, 1) : null,
        profile: row
          ? {
              name: this.profileText(row.name, 120),
              bio: this.profileText(row.bio, 500),
              location: this.profileText(row.location, 120),
              avatarUri: this.profileText(row.avatarUri, 2048),
            }
          : { name: null, bio: null, location: null, avatarUri: null },
      };
    });
  }

  async enrollAccount(
    uid: string,
    name: string,
    key: string
  ): Promise<AccountRegistrationReceipt> {
    this.uid(uid);
    if (
      typeof name !== 'string' ||
      name.trim() !== name ||
      name.length < 1 ||
      name.length > 120 ||
      typeof key !== 'string' ||
      !/^[\x21-\x7e]{1,128}$/.test(key)
    )
      throw new CanonicalIdentityInputError(
        'Invalid enrollment name or Idempotency-Key'
      );
    try {
      parseProfileUpdate({
        name,
        expectedRevision: 1,
        bio: null,
        location: null,
        socialLinks: {},
      });
    } catch {
      throw new CanonicalIdentityInputError('Invalid enrollment profile name');
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ operation: 'initial-enrollment-v1', name }))
      .digest('hex');
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid, true);
      this.active(current);
      const [receipt] = await manager.query<
        { fingerprint: string; revision: unknown }[]
      >(
        'SELECT fingerprint, revision FROM identity_account_commands WHERE identityId = ? AND commandKey = ?',
        [uid, key]
      );
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new CanonicalIdentityConflict(
            'Idempotency-Key belongs to another registration'
          );
        const revision = integer(receipt.revision, 2);
        required(
          revision <= current.revision,
          'Invalid enrollment receipt revision'
        );
        return { identityId: uid, revision, registered: true };
      }
      const [account] = await manager.query<{ identityId: string }[]>(
        'SELECT identityId FROM identity_accounts WHERE identityId = ?',
        [uid]
      );
      if (account)
        throw new CanonicalIdentityConflict(
          'Account already registered. Sign in to continue.'
        );
      const at = Math.max(current.updatedAt, integer(this.now(), 1));
      const revision = integer(current.revision + 1, 1);
      await manager.query(
        'INSERT INTO identity_accounts (identityId, name, bio, location, avatarUri, registeredAt, updatedAt) VALUES (?, ?, NULL, NULL, NULL, ?, ?)',
        [uid, name, at, at]
      );
      await manager.query(
        'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
        [revision, at, current.subjectId]
      );
      await manager.query(
        'INSERT INTO identity_account_commands (identityId, commandKey, fingerprint, revision, createdAt) VALUES (?, ?, ?, ?, ?)',
        [uid, key, fingerprint, revision, at]
      );
      await this.event(
        manager,
        'identity.updated',
        { ...current, revision, updatedAt: at },
        at
      );
      return { identityId: uid, revision, registered: true };
    });
  }

  async completeRegistration(
    uid: string,
    input: AccountRegistration,
    key: string
  ): Promise<AccountRegistrationReceipt> {
    this.uid(uid);
    try {
      required(
        typeof key === 'string' && /^[\x21-\x7e]{1,128}$/.test(key),
        'Invalid registration command key'
      );
      required(
        input &&
          typeof input.name === 'string' &&
          input.name.trim() === input.name &&
          input.name.length > 0 &&
          input.name.length <= 120,
        'Invalid profile name'
      );
      this.profileText(input.bio, 500);
      this.profileText(input.location, 120);
      this.profileText(input.avatarUri, 2048);
      parseProfileUpdate({
        name: input.name,
        bio: input.bio,
        location: input.location,
        expectedRevision: input.expectedRevision,
        socialLinks: {},
      });
      if (input.avatarUri !== null) {
        const url = new URL(input.avatarUri);
        required(
          ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !/\s/.test(input.avatarUri),
          'Invalid profile avatar'
        );
      }
      required(
        Number.isSafeInteger(input.expectedRevision) &&
          input.expectedRevision > 0,
        'Invalid expected revision'
      );
    } catch {
      throw new CanonicalIdentityInputError(
        'Invalid registration input or Idempotency-Key'
      );
    }
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          name: input.name,
          bio: input.bio,
          location: input.location,
          avatarUri: input.avatarUri,
          expectedRevision: input.expectedRevision,
        })
      )
      .digest('hex');
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid, true);
      this.active(current);
      const [receipt] = await manager.query<
        { fingerprint: string; revision: unknown }[]
      >(
        'SELECT fingerprint, revision FROM identity_account_commands WHERE identityId = ? AND commandKey = ?',
        [uid, key]
      );
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new CanonicalIdentityConflict(
            'Idempotency-Key belongs to another registration'
          );
        const revision = integer(receipt.revision, 1);
        required(
          revision === input.expectedRevision + 1 &&
            revision <= current.revision,
          'Invalid registration receipt revision'
        );
        return { identityId: uid, revision, registered: true };
      }
      if (current.revision !== input.expectedRevision)
        throw new CanonicalIdentityConflict('Identity revision changed');
      const [account] = await manager.query<{ identityId: string }[]>(
        'SELECT identityId FROM identity_accounts WHERE identityId = ?',
        [uid]
      );
      if (account)
        throw new CanonicalIdentityConflict(
          'Account already registered. Use the profile update command.'
        );
      const at = Math.max(current.updatedAt, integer(this.now(), 1));
      const revision = integer(current.revision + 1, 1);
      await manager.query(
        'INSERT INTO identity_accounts (identityId, name, bio, location, avatarUri, registeredAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uid, input.name, input.bio, input.location, input.avatarUri, at, at]
      );
      await manager.query(
        'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
        [revision, at, current.subjectId]
      );
      await manager.query(
        'INSERT INTO identity_account_commands (identityId, commandKey, fingerprint, revision, createdAt) VALUES (?, ?, ?, ?, ?)',
        [uid, key, fingerprint, revision, at]
      );
      await this.event(
        manager,
        'identity.updated',
        { ...current, revision, updatedAt: at },
        at
      );
      return { identityId: uid, revision, registered: true };
    });
  }

  async getProfile(uid: string): Promise<PrivateProfile> {
    this.uid(uid);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await this.read(manager, uid);
      this.active(current);
      const [row] = await manager.query<Record<string, unknown>[]>(
        'SELECT name, bio, location, contactEmail, avatarUri, socialLinks, registeredAt, updatedAt, (SELECT id FROM identity_profile_avatars WHERE identityId = identity_accounts.identityId) AS avatarId FROM identity_accounts WHERE identityId = ?',
        [uid]
      );
      try {
        return parsePrivateProfile({
          identityId: uid,
          publicId: current.subjectId,
          revision: current.revision,
          registeredAt: row ? integer(row.registeredAt, 1) : null,
          updatedAt: row ? integer(row.updatedAt, 1) : current.updatedAt,
          profile: row
            ? {
                name: row.name,
                bio: row.bio,
                location: row.location,
                contactEmail: row.contactEmail,
                avatarUri: row.avatarUri,
                avatarId: row.avatarId ?? null,
                socialLinks:
                  row.socialLinks === null
                    ? {}
                    : typeof row.socialLinks === 'string'
                    ? JSON.parse(row.socialLinks)
                    : row.socialLinks,
              }
            : {
                name: null,
                bio: null,
                location: null,
                avatarUri: null,
                socialLinks: {},
              },
        });
      } catch {
        throw new CanonicalIdentityUnavailable('Invalid stored profile');
      }
    });
  }

  async updateProfile(
    uid: string,
    input: ProfileUpdate,
    key: string
  ): Promise<ProfileUpdateReceipt> {
    this.uid(uid);
    let profile: ProfileUpdate;
    try {
      profile = parseProfileUpdate(input);
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new Error('Invalid key');
    } catch {
      throw new CanonicalIdentityInputError(
        'Invalid profile input or Idempotency-Key'
      );
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ operation: 'profile-update-v1', ...profile }))
      .digest('hex');
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid, true);
      this.active(current);
      const [receipt] = await manager.query<
        { fingerprint: string; revision: unknown }[]
      >(
        'SELECT fingerprint, revision FROM identity_account_commands WHERE identityId = ? AND commandKey = ?',
        [uid, key]
      );
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new CanonicalIdentityConflict(
            'Idempotency-Key belongs to another command'
          );
        const revision = integer(receipt.revision, 2);
        required(
          revision === profile.expectedRevision + 1 &&
            revision <= current.revision,
          'Invalid profile receipt revision'
        );
        return { identityId: uid, revision };
      }
      if (current.revision !== profile.expectedRevision)
        throw new CanonicalIdentityConflict(
          'Profile revision changed. Reload before saving.'
        );
      const at = Math.max(current.updatedAt, integer(this.now(), 1));
      const revision = integer(current.revision + 1, 1);
      const writesContact = Object.prototype.hasOwnProperty.call(
        profile,
        'contactEmail'
      );
      await manager.query(
        `INSERT INTO identity_accounts (identityId, name, bio, location, avatarUri, socialLinks, registeredAt, updatedAt${
          writesContact ? ', contactEmail' : ''
        }) VALUES (?, ?, ?, ?, NULL, ?, ?, ?${
          writesContact ? ', ?' : ''
        }) ON DUPLICATE KEY UPDATE name = VALUES(name), bio = VALUES(bio), location = VALUES(location), socialLinks = VALUES(socialLinks), updatedAt = VALUES(updatedAt)${
          writesContact ? ', contactEmail = VALUES(contactEmail)' : ''
        }`,
        [
          uid,
          profile.name,
          profile.bio,
          profile.location,
          JSON.stringify(profile.socialLinks),
          at,
          at,
          ...(writesContact ? [profile.contactEmail] : []),
        ]
      );
      await manager.query(
        'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
        [revision, at, current.subjectId]
      );
      await manager.query(
        'INSERT INTO identity_account_commands (identityId, commandKey, fingerprint, revision, createdAt) VALUES (?, ?, ?, ?, ?)',
        [uid, key, fingerprint, revision, at]
      );
      await this.event(
        manager,
        'identity.updated',
        { ...current, revision, updatedAt: at },
        at
      );
      return { identityId: uid, revision };
    });
  }

  async getPreferences(uid: string): Promise<AccountPreferences> {
    this.uid(uid);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await this.read(manager, uid);
      this.active(current);
      const [row] = await manager.query<
        { preferences: unknown; updatedAt: unknown }[]
      >(
        'SELECT preferences, updatedAt FROM identity_preferences WHERE identityId = ?',
        [uid]
      );
      try {
        const updatedAt = row ? integer(row.updatedAt, 1) : null;
        required(
          updatedAt === null || updatedAt <= current.updatedAt,
          'Invalid stored preferences timestamp'
        );
        return parseAccountPreferences({
          identityId: uid,
          revision: current.revision,
          updatedAt,
          preferences: row
            ? typeof row.preferences === 'string'
              ? JSON.parse(row.preferences)
              : row.preferences
            : defaultAccountPreferences(),
        });
      } catch {
        throw new CanonicalIdentityUnavailable('Invalid stored preferences');
      }
    });
  }

  async updatePreferences(
    uid: string,
    input: PreferencesUpdate,
    key: string
  ): Promise<PreferencesUpdateReceipt> {
    this.uid(uid);
    let update: PreferencesUpdate;
    try {
      update = parsePreferencesUpdate(input);
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new Error('Invalid key');
    } catch {
      throw new CanonicalIdentityInputError(
        'Invalid preferences input or Idempotency-Key'
      );
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ operation: 'preferences-update-v1', ...update }))
      .digest('hex');
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await this.read(manager, uid, true);
      this.active(current);
      const [receipt] = await manager.query<
        { fingerprint: string; revision: unknown }[]
      >(
        'SELECT fingerprint, revision FROM identity_account_commands WHERE identityId = ? AND commandKey = ?',
        [uid, key]
      );
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new CanonicalIdentityConflict(
            'Idempotency-Key belongs to another command'
          );
        const revision = integer(receipt.revision, 2);
        required(
          revision === update.expectedRevision + 1 &&
            revision <= current.revision,
          'Invalid preferences receipt revision'
        );
        return { identityId: uid, revision };
      }
      if (current.revision !== update.expectedRevision)
        throw new CanonicalIdentityConflict(
          'Account revision changed. Reload before saving preferences.'
        );
      const at = Math.max(current.updatedAt, integer(this.now(), 1));
      const revision = integer(current.revision + 1, 1);
      await manager.query(
        'INSERT INTO identity_preferences (identityId, preferences, updatedAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE preferences = VALUES(preferences), updatedAt = VALUES(updatedAt)',
        [uid, JSON.stringify(update.preferences), at]
      );
      await manager.query(
        'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
        [revision, at, current.subjectId]
      );
      await manager.query(
        'INSERT INTO identity_account_commands (identityId, commandKey, fingerprint, revision, createdAt) VALUES (?, ?, ?, ?, ?)',
        [uid, key, fingerprint, revision, at]
      );
      await this.event(
        manager,
        'identity.updated',
        { ...current, revision, updatedAt: at },
        at
      );
      return { identityId: uid, revision };
    });
  }

  private active(
    current: CanonicalIdentityState | null
  ): asserts current is CanonicalIdentityState {
    assertActiveIdentity(current);
  }

  private profileText(value: unknown, max: number): string | null {
    required(
      value === null || (typeof value === 'string' && value.length <= max),
      'Invalid stored profile text'
    );
    return value;
  }

  private uid(uid: string): void {
    if (!isCanonicalIdentityId(uid))
      throw new CanonicalIdentityInputError('Invalid canonical identity ID');
  }

  private read(
    manager: EntityManager,
    uid: string,
    lock = false
  ): Promise<CanonicalIdentityState | null> {
    return readCanonicalIdentity(manager, uid, lock);
  }

  private async event(
    manager: EntityManager,
    type:
      | 'identity.created'
      | 'identity.authenticated'
      | 'identity.updated'
      | 'identity.deleted',
    current: CanonicalIdentityState,
    at: number,
    provider = current.provider
  ): Promise<void> {
    await appendCanonicalIdentityEvent(
      manager,
      type,
      current,
      at,
      this.id,
      provider
    );
  }
}
