import { mentionInboxRecord } from './mysql-mention-inbox';
import {
  favoriteWatchRow,
  favoriteUpdateReceiptRow,
} from './mysql-favorite-updates';
import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { readonlyMysqlSnapshot } from '@sdk/extras/mysql';
import {
  parsePrivateProfile,
  parseProfileFollow,
  parseProfileBadgeSnapshot,
} from '@domains/customer/profiles';
import { parseFavoriteTarget } from '@domains/customer/favorites';
import {
  defaultAccountPreferences,
  parseAccountPreferences,
} from '@domains/customer/preferences';
import {
  AccountExportCaptureSequence,
  credentialSubject,
  AccountExportSourceInvalid,
  CanonicalIdentityAccessDenied,
  isCanonicalIdentityId,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import type { AccountExportSource } from '@sdk/features/identity/libs/management';
import {
  assertActiveIdentity,
  canonicalIdentityState,
  canonicalSqlInteger,
} from './canonical-account-sql';
import { validateProfileAvatarImage } from './mysql-profile-avatars';
import { replyInboxRecord } from './mysql-reply-inbox';

function decode<T>(operation: () => T): T {
  try {
    return operation();
  } catch {
    throw new AccountExportSourceInvalid(
      'Invalid canonical account export data'
    );
  }
}
function json(input: unknown): unknown {
  return typeof input === 'string' ? JSON.parse(input) : input;
}

export class MysqlAccountExportSource implements AccountExportSource {
  readonly name = 'account';
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  async *capture(
    identityId: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry> {
    if (!isCanonicalIdentityId(identityId))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    const sequence = new AccountExportCaptureSequence(this.name);
    let records = 0;
    const entry = (collection: string, data: unknown) => {
      const record = sequence.accept({
        type: 'record',
        source: this.name,
        collection,
        data,
      });
      records++;
      return record;
    };
    const startedAt = this.now();
    const result = readonlyMysqlSnapshot(
      this.source,
      signal,
      async function* (reader): AsyncIterable<AccountExportEntry> {
        const [identity] = await reader.query(
          'SELECT id, identity_id, claim, kind, provider_type, is_active, is_suspended, is_deleted, revision, created_at, updated_at, deleted_at FROM identities WHERE claim = ?',
          [identityId]
        );
        if (!identity)
          throw new CanonicalIdentityAccessDenied('Identity is unavailable');
        const current = decode(() => canonicalIdentityState(identity));
        assertActiveIdentity(current);
        if (current.identityId !== identityId || current.kind !== 'user')
          throw new CanonicalIdentityAccessDenied(
            'A registered account is required'
          );
        const [profile] = await reader.query(
          'SELECT name, bio, location, contactEmail, avatarUri, socialLinks, registeredAt, updatedAt FROM identity_accounts WHERE identityId = ?',
          [identityId]
        );
        if (!profile || profile.registeredAt === null)
          throw new CanonicalIdentityAccessDenied(
            'Complete registration before exporting account data'
          );
        const [avatar] = await reader.query(
          'SELECT id, payload, sha256, width, height, createdAt FROM identity_profile_avatars WHERE identityId = ?',
          [identityId]
        );
        const privateProfile = decode(() =>
          parsePrivateProfile({
            identityId,
            publicId: current.subjectId,
            revision: current.revision,
            registeredAt: canonicalSqlInteger(profile.registeredAt, 1),
            updatedAt: canonicalSqlInteger(profile.updatedAt, 1),
            profile: {
              name: profile.name,
              bio: profile.bio,
              location: profile.location,
              contactEmail: profile.contactEmail,
              avatarUri: profile.avatarUri,
              avatarId: avatar?.id ?? null,
              socialLinks:
                profile.socialLinks === null ? {} : json(profile.socialLinks),
            },
          })
        );
        yield sequence.accept({
          type: 'begin',
          source: 'account',
          at: startedAt,
        });
        yield entry('identity', {
          identityId: current.identityId,
          publicId: current.subjectId,
          kind: current.kind,
          provider: current.provider,
          revision: current.revision,
          createdAt: current.createdAt,
          updatedAt: current.updatedAt,
        });
        yield entry('profile', privateProfile);
        const bindings = await reader.query(
          'SELECT CONVERT(issuer USING utf8mb4) AS issuer, CONVERT(subject USING utf8mb4) AS subject, createdAt FROM identity_credential_bindings WHERE identityId = ? ORDER BY issuer, subject LIMIT 65',
          [identityId]
        );
        if (bindings.length > 64)
          throw new AccountExportSourceInvalid('Too many credential bindings');
        for (const binding of bindings)
          yield entry('credential-binding', {
            ...credentialSubject({
              issuer: binding.issuer,
              subject: binding.subject,
            }),
            createdAt: canonicalSqlInteger(binding.createdAt, 1),
          });
        const [preferences] = await reader.query(
          'SELECT preferences, updatedAt FROM identity_preferences WHERE identityId = ?',
          [identityId]
        );
        yield entry(
          'preferences',
          decode(() =>
            parseAccountPreferences({
              identityId,
              revision: current.revision,
              updatedAt: preferences
                ? canonicalSqlInteger(preferences.updatedAt, 1)
                : null,
              preferences: preferences
                ? json(preferences.preferences)
                : defaultAccountPreferences(),
            })
          )
        );
        let kind: string | null = null,
          id: string | null = null;
        for (;;) {
          const rows: Record<string, unknown>[] = await reader.query(
            'SELECT targetKind, targetId, addedAt FROM identity_favorites WHERE identityId = ? AND (? IS NULL OR targetKind > ? OR (targetKind = ? AND targetId > ?)) ORDER BY targetKind, targetId LIMIT 128',
            [identityId, kind, kind, kind, id]
          );
          for (const row of rows)
            yield entry(
              'favorites',
              decode(() => ({
                ...parseFavoriteTarget({
                  kind: row.targetKind,
                  id: row.targetId,
                }),
                addedAt: canonicalSqlInteger(row.addedAt, 1),
              }))
            );
          if (rows.length < 128) break;
          const last = decode(() =>
            parseFavoriteTarget({
              kind: rows[rows.length - 1].targetKind,
              id: rows[rows.length - 1].targetId,
            })
          );
          kind = last.kind;
          id = last.id;
        }
        let notificationAfter = '';
        for (;;) {
          const rows: Record<string, unknown>[] = await reader.query(
            'SELECT * FROM identity_reply_notifications WHERE identityId=? AND id>? ORDER BY id LIMIT 128',
            [identityId, notificationAfter]
          );
          for (const row of rows) {
            const receipt = decode(() => replyInboxRecord(row));
            if (receipt.event.recipientId !== identityId)
              throw new AccountExportSourceInvalid(
                'Notification export scope differs'
              );
            yield entry('reply-notifications', receipt);
            notificationAfter = receipt.event.id;
          }
          if (rows.length < 128) break;
        }
        let mentionAfter = '';
        for (;;) {
          const rows: Record<string, unknown>[] = await reader.query(
            'SELECT * FROM identity_mention_notifications WHERE identityId=? AND id>? ORDER BY id LIMIT 128',
            [identityId, mentionAfter]
          );
          for (const row of rows) {
            const receipt = decode(() => mentionInboxRecord(row));
            if (receipt.event.recipientId !== identityId)
              throw new AccountExportSourceInvalid(
                'Notification export scope differs'
              );
            yield entry('mention-notifications', receipt);
            mentionAfter = receipt.event.id;
          }
          if (rows.length < 128) break;
        }
        for (const table of [
          'identity_favorite_watches',
          'identity_favorite_notifications',
        ]) {
          const key =
            table === 'identity_favorite_watches' ? 'generation' : 'id';
          let after = '';
          for (;;) {
            const rows: Record<string, unknown>[] = await reader.query(
              `SELECT * FROM ${table} WHERE identityId=? AND ${key}>? ORDER BY ${key} LIMIT 128`,
              [identityId, after]
            );
            for (const row of rows) {
              if (row.identityId !== identityId)
                throw new AccountExportSourceInvalid(
                  'Favorite update export scope differs'
                );
              const data =
                key === 'generation'
                  ? decode(() => {
                      const watch = favoriteWatchRow(row);
                      return {
                        target: watch.lease.target,
                        generation: watch.lease.generation,
                        version: watch.version,
                        attempts: watch.attempts,
                        failedAt: watch.failedAt,
                      };
                    })
                  : decode(() => ({
                      ...favoriteUpdateReceiptRow(row),
                      sourceAt: canonicalSqlInteger(row.sourceAt),
                      delivered: row.delivered === 1,
                    }));
              yield entry(
                key === 'generation'
                  ? 'favorite-subscriptions'
                  : 'favorite-updates',
                data
              );
              after = String(row[key]);
            }
            if (rows.length < 128) break;
          }
        }
        for (const direction of ['followers', 'following'] as const) {
          const owner = direction === 'followers' ? 'ownerId' : 'requesterId';
          const target = direction === 'followers' ? 'requesterId' : 'ownerId';
          let after: string | null = null;
          for (;;) {
            const rows: Record<string, unknown>[] = await reader.query(
              `SELECT ownerId, requesterId, revision, status, updatedAt FROM identity_profile_follows WHERE ${owner} = ? AND (? IS NULL OR ${target} > ?) ORDER BY ${target} LIMIT 128`,
              [current.subjectId, after, after]
            );
            for (const row of rows) {
              const follow = decode(() =>
                parseProfileFollow({
                  ownerId: row.ownerId,
                  requesterId: row.requesterId,
                  revision: canonicalSqlInteger(row.revision, 1),
                  status: row.status,
                })
              );
              yield entry(direction, {
                ...follow,
                updatedAt: decode(() => canonicalSqlInteger(row.updatedAt, 1)),
              });
              after =
                direction === 'followers' ? follow.requesterId : follow.ownerId;
            }
            if (rows.length < 128) break;
          }
        }
        const badges = await reader.query(
          'SELECT kind, revision, active, awardedAt, updatedAt FROM identity_profile_badges WHERE ownerId = ? ORDER BY kind LIMIT 3',
          [current.subjectId]
        );
        const snapshot = decode(() =>
          parseProfileBadgeSnapshot({
            profileId: current.subjectId,
            revision: badges.reduce(
              (revision, badge) =>
                Math.max(revision, canonicalSqlInteger(badge.revision, 1)),
              0
            ),
            badges: badges.map((badge) => {
              if (badge.active !== 0 && badge.active !== 1)
                throw new Error('Invalid badge state');
              return {
                kind: badge.kind,
                revision: canonicalSqlInteger(badge.revision, 1),
                active: badge.active === 1,
                awardedAt: canonicalSqlInteger(badge.awardedAt, 1),
                updatedAt: canonicalSqlInteger(badge.updatedAt, 1),
              };
            }),
          })
        );
        yield entry('badges', snapshot);
        if (avatar) {
          const image = decode(() => {
            if (!Buffer.isBuffer(avatar.payload))
              throw new Error('Missing avatar');
            const image = {
              bytes: avatar.payload,
              width: canonicalSqlInteger(avatar.width, 1),
              height: canonicalSqlInteger(avatar.height, 1),
            };
            validateProfileAvatarImage(image);
            if (
              createHash('sha256').update(image.bytes).digest('hex') !==
              avatar.sha256
            )
              throw new Error('Corrupt avatar');
            return image;
          });
          yield entry('avatar', {
            id: avatar.id,
            mediaType: 'image/webp',
            width: image.width,
            height: image.height,
            createdAt: decode(() => canonicalSqlInteger(avatar.createdAt, 1)),
            bytes: image.bytes.length,
            sha256: avatar.sha256,
            encoding: 'base64',
            payload: image.bytes.toString('base64'),
          });
        }
      }
    );
    for await (const record of result) yield record;
    signal.throwIfAborted();
    yield sequence.accept({
      type: 'end',
      source: this.name,
      at: this.now(),
      records,
    });
  }
}
