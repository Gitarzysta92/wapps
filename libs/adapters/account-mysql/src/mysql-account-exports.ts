import { ACCOUNT_EXPORT_SOURCES } from '@wapps/account';
import { createHash, randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportLimitExceeded,
  AccountExportSourceInvalid,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  accountExportId,
  parseAccountExportArtifact,
  type AccountExportArtifact,
  type AccountExportFailure,
  type AccountExportJob,
} from '@sdk/features/identity/core';
import type {
  AccountExportJobs,
  AccountExportStore,
  AccountExportWork,
} from '@sdk/features/identity/libs/management';
import {
  assertActiveIdentity,
  canonicalSqlInteger,
  readCanonicalIdentity,
} from './canonical-account-sql';
import {
  accountExportDigest,
  accountExportFromSql,
  accountExportView,
  type AccountExportRow,
} from './account-export-sql';

type Raw = Record<string, unknown>;
type Chunk = { position: number; payload: Buffer; sha256: string };

export class MysqlAccountExports
  implements AccountExportStore, AccountExportJobs
{
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now,
    private readonly id = randomUUID
  ) {}

  async request(uid: string, key: string): Promise<AccountExportJob> {
    if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new CanonicalIdentityInputError('Invalid export request key');
    return this.source.transaction('READ COMMITTED', async (manager) => {
      await this.active(manager, uid, true);
      const at = this.now();
      const [replay] = await manager.query<Raw[]>(
        'SELECT * FROM identity_account_exports WHERE identityId = ? AND commandKey = ?',
        [uid, key]
      );
      if (replay) return accountExportView(accountExportFromSql(replay), at);
      const [existing] = await manager.query<Raw[]>(
        "SELECT * FROM identity_account_exports WHERE identityId = ? AND expiresAt > ? AND status IN ('queued', 'building', 'ready') LIMIT 1",
        [uid, at]
      );
      if (existing)
        throw new CanonicalIdentityConflict(
          'An account export already exists. Use or remove it before requesting a fresh snapshot.'
        );
      const recent = await manager.query<Raw[]>(
        'SELECT id FROM identity_account_exports WHERE identityId = ? AND requestedAt > ? ORDER BY requestedAt DESC LIMIT ?',
        [
          uid,
          at - ACCOUNT_EXPORT_LIMITS.retentionMs,
          ACCOUNT_EXPORT_LIMITS.requestsPerDay,
        ]
      );
      if (recent.length >= ACCOUNT_EXPORT_LIMITS.requestsPerDay)
        throw new CanonicalIdentityConflict(
          'Account export request limit reached. Try again after the 24-hour request window.'
        );
      const id = accountExportId(this.id());
      await manager.query(
        "INSERT INTO identity_account_exports (id, identityId, commandKey, status, requestedAt, expiresAt, availableAt, attempts) VALUES (?, ?, ?, 'queued', ?, ?, ?, 0)",
        [id, uid, key, at, at + ACCOUNT_EXPORT_LIMITS.retentionMs, at]
      );
      return accountExportView(await this.owned(manager, uid, id), at);
    });
  }

  latest(uid: string): Promise<AccountExportJob | null> {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      await this.active(manager, uid);
      const [row] = await manager.query<Raw[]>(
        'SELECT * FROM identity_account_exports WHERE identityId = ? ORDER BY requestedAt DESC, id DESC LIMIT 1',
        [uid]
      );
      return row
        ? accountExportView(accountExportFromSql(row), this.now())
        : null;
    });
  }

  inspect(uid: string, id: string): Promise<AccountExportJob> {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      await this.active(manager, uid);
      return accountExportView(await this.owned(manager, uid, id), this.now());
    });
  }

  cancel(uid: string, id: string): Promise<AccountExportJob> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      await this.active(manager, uid, true);
      const row = await this.owned(manager, uid, id, true);
      await this.clear(manager, row.id, 'cancelled');
      return accountExportView(await this.owned(manager, uid, id), this.now());
    });
  }

  async *download(uid: string, id: string): AsyncIterable<Uint8Array> {
    let expected: AccountExportArtifact | undefined;
    const hash = createHash('sha256');
    for (let position = 0; ; position++) {
      const chunk = await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          // All mutations lock identity before job. Keep each download check short.
          await this.active(manager, uid, true);
          const row = await this.owned(manager, uid, id, true);
          if (
            accountExportView(row, this.now()).status !== 'ready' ||
            !row.artifact
          )
            throw new CanonicalIdentityConflict(
              'Account export is no longer available'
            );
          const current = row.artifact;
          if (expected && JSON.stringify(expected) !== JSON.stringify(current))
            throw new AccountExportSourceInvalid(
              'Account export artifact changed'
            );
          expected = current;
          if (position >= current.chunks) return null;
          const [stored] = await manager.query<Chunk[]>(
            'SELECT position, payload, sha256 FROM identity_account_export_chunks WHERE exportId = ? AND attemptId = ? AND position = ?',
            [id, row.leaseToken, position]
          );
          this.checkChunk(stored, position, current);
          return stored.payload;
        }
      );
      if (!chunk) break;
      hash.update(chunk);
      if (
        expected &&
        position === expected.chunks - 1 &&
        hash.digest('hex') !== expected.sha256
      )
        throw new AccountExportSourceInvalid('Account export digest mismatch');
      yield chunk;
    }
  }

  async claim(at: number, token: string): Promise<AccountExportWork | null> {
    accountExportId(token);
    const [candidate] = await this.source.query<Raw[]>(
      "SELECT * FROM identity_account_exports WHERE status IN ('queued', 'building') AND expiresAt > ? AND attempts < ? AND availableAt <= ? AND (leasedUntil IS NULL OR leasedUntil <= ?) ORDER BY availableAt, id LIMIT 1",
      [at, ACCOUNT_EXPORT_LIMITS.attempts, at, at]
    );
    if (!candidate) return null;
    const selected = accountExportFromSql(candidate);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      let active = true;
      try {
        await this.active(manager, selected.identityId, true);
      } catch (error) {
        if (!(error instanceof CanonicalIdentityAccessDenied)) throw error;
        active = false;
      }
      const row = await this.owned(
        manager,
        selected.identityId,
        selected.id,
        true
      );
      const current = Math.max(at, this.now());
      if (
        !['queued', 'building'].includes(row.status) ||
        row.expiresAt <= current ||
        row.attempts >= ACCOUNT_EXPORT_LIMITS.attempts ||
        row.availableAt > current ||
        (row.leasedUntil !== null && row.leasedUntil > current)
      )
        return null;
      if (!active) {
        await this.clear(manager, row.id, 'failed', 'account-unavailable');
        return null;
      }
      const attempts = row.attempts + 1;
      await manager.query(
        'DELETE FROM identity_account_export_chunks WHERE exportId = ?',
        [row.id]
      );
      await manager.query(
        "UPDATE identity_account_exports SET status = 'building', attempts = ?, leaseToken = ?, leasedUntil = ?, artifact = NULL, readyAt = NULL, failure = NULL WHERE id = ?",
        [
          attempts,
          token,
          Math.min(row.expiresAt, current + ACCOUNT_EXPORT_LIMITS.leaseMs),
          row.id,
        ]
      );
      return {
        id: row.id,
        identityId: row.identityId,
        token,
        attempts,
        expiresAt: row.expiresAt,
      };
    });
  }

  heartbeat(work: AccountExportWork, at: number): Promise<boolean> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      if (!(await this.leased(manager, work, at))) return false;
      await manager.query(
        'UPDATE identity_account_exports SET leasedUntil = ? WHERE id = ?',
        [
          Math.min(
            work.expiresAt,
            Math.max(at, this.now()) + ACCOUNT_EXPORT_LIMITS.leaseMs
          ),
          work.id,
        ]
      );
      return true;
    });
  }

  append(
    work: AccountExportWork,
    position: number,
    bytes: Uint8Array,
    at: number
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(position) ||
      position < 0 ||
      !bytes.length ||
      bytes.length > ACCOUNT_EXPORT_LIMITS.chunkBytes ||
      (position + 1) * ACCOUNT_EXPORT_LIMITS.chunkBytes >
        ACCOUNT_EXPORT_LIMITS.archiveBytes
    )
      throw new AccountExportLimitExceeded(
        'Account export exceeds configured storage bounds'
      );
    // Copy before awaiting a transaction, so caller mutation cannot change its digest.
    const payload = Buffer.from(bytes),
      sha256 = accountExportDigest(payload);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      if (!(await this.leased(manager, work, at))) return false;
      const [previous] = await manager.query<
        { sha256: string; bytes: number | string }[]
      >(
        'SELECT sha256, OCTET_LENGTH(payload) AS bytes FROM identity_account_export_chunks WHERE exportId = ? AND attemptId = ? AND position = ?',
        [work.id, work.token, position]
      );
      if (previous) {
        if (
          previous.sha256 !== sha256 ||
          canonicalSqlInteger(previous.bytes) !== payload.length
        )
          throw new AccountExportSourceInvalid(
            'Account export chunk cannot be replaced'
          );
        return true;
      }
      const [count] = await manager.query<
        { total: number | string; lastBytes: number | string | null }[]
      >(
        'SELECT COUNT(*) AS total, MIN(OCTET_LENGTH(payload)) AS lastBytes FROM identity_account_export_chunks WHERE exportId = ? AND attemptId = ?',
        [work.id, work.token]
      );
      if (
        canonicalSqlInteger(count.total) !== position ||
        (position > 0 &&
          canonicalSqlInteger(count.lastBytes) !==
            ACCOUNT_EXPORT_LIMITS.chunkBytes)
      )
        throw new AccountExportSourceInvalid(
          'Account export chunks are incomplete or unordered'
        );
      await manager.query(
        'INSERT INTO identity_account_export_chunks (exportId, attemptId, position, payload, sha256) VALUES (?, ?, ?, ?, ?)',
        [work.id, work.token, position, payload, sha256]
      );
      return true;
    });
  }

  complete(
    work: AccountExportWork,
    input: AccountExportArtifact,
    at: number
  ): Promise<boolean> {
    const complete = parseAccountExportArtifact(input, ACCOUNT_EXPORT_SOURCES);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      if (!(await this.leased(manager, work, at))) return false;
      const hash = createHash('sha256');
      let position = 0;
      for (;;) {
        const chunks = await manager.query<Chunk[]>(
          'SELECT position, payload, sha256 FROM identity_account_export_chunks WHERE exportId = ? AND attemptId = ? AND position >= ? ORDER BY position LIMIT 16',
          [work.id, work.token, position]
        );
        for (const chunk of chunks) {
          this.checkChunk(chunk, position, complete);
          hash.update(chunk.payload);
          position++;
        }
        if (chunks.length < 16) break;
      }
      if (
        position !== complete.chunks ||
        hash.digest('hex') !== complete.sha256
      )
        throw new AccountExportSourceInvalid(
          'Account export storage is incomplete'
        );
      if (!(await this.leased(manager, work, Math.max(at, this.now()))))
        return false;
      await manager.query(
        "UPDATE identity_account_exports SET status = 'ready', artifact = ?, readyAt = ?, leasedUntil = NULL WHERE id = ?",
        [JSON.stringify(complete), Math.max(at, this.now()), work.id]
      );
      return true;
    });
  }

  async failed(
    work: AccountExportWork,
    failure: AccountExportFailure,
    at: number,
    terminal: boolean
  ): Promise<void> {
    await this.source.transaction('READ COMMITTED', async (manager) => {
      await readCanonicalIdentity(manager, work.identityId, true);
      const row = await this.owned(manager, work.identityId, work.id, true);
      if (
        row.status !== 'building' ||
        row.leaseToken !== work.token ||
        row.attempts !== work.attempts
      )
        return;
      const done = terminal || row.attempts >= ACCOUNT_EXPORT_LIMITS.attempts;
      await this.clear(
        manager,
        row.id,
        done ? 'failed' : 'queued',
        done ? failure : null
      );
      await manager.query(
        'UPDATE identity_account_exports SET availableAt = ? WHERE id = ?',
        [
          Math.max(at, this.now()) +
            Math.min(300_000, 1000 * 2 ** work.attempts),
          work.id,
        ]
      );
    });
  }

  async purge(at: number): Promise<void> {
    // Select candidates without locks, then take the same identity -> job order as writes.
    const candidates = await this.source.query<
      { id: string; identityId: string }[]
    >(
      "SELECT e.id, e.identityId FROM identity_account_exports e LEFT JOIN identities i ON BINARY i.identity_id = BINARY e.identityId WHERE e.status NOT IN ('expired', 'cancelled') AND (e.expiresAt <= ? OR i.id IS NULL OR i.is_deleted = 1 OR (e.status = 'building' AND e.attempts >= ? AND e.leasedUntil <= ?)) ORDER BY e.expiresAt, e.id LIMIT 16",
      [at, ACCOUNT_EXPORT_LIMITS.attempts, at]
    );
    for (const candidate of candidates)
      await this.source.transaction('READ COMMITTED', async (manager) => {
        const identity = await readCanonicalIdentity(
          manager,
          candidate.identityId,
          true
        );
        const row = await this.owned(
          manager,
          candidate.identityId,
          candidate.id,
          true
        );
        if (['expired', 'cancelled'].includes(row.status)) return;
        const current = Math.max(at, this.now());
        if (row.expiresAt <= current || !identity || identity.isDeleted)
          await this.clear(manager, row.id, 'expired');
        else if (
          row.status === 'building' &&
          row.attempts >= ACCOUNT_EXPORT_LIMITS.attempts &&
          row.leasedUntil !== null &&
          row.leasedUntil <= current
        )
          await this.clear(manager, row.id, 'failed', 'source-unavailable');
      });
  }

  private checkChunk(
    chunk: Chunk | undefined,
    position: number,
    artifact: AccountExportArtifact
  ): asserts chunk is Chunk {
    const length =
      position < artifact.chunks - 1
        ? ACCOUNT_EXPORT_LIMITS.chunkBytes
        : artifact.bytes - position * ACCOUNT_EXPORT_LIMITS.chunkBytes;
    if (
      !chunk ||
      canonicalSqlInteger(chunk.position) !== position ||
      position >= artifact.chunks ||
      !Buffer.isBuffer(chunk.payload) ||
      chunk.payload.length !== length ||
      accountExportDigest(chunk.payload) !== chunk.sha256
    )
      throw new AccountExportSourceInvalid(
        'Account export chunk is unavailable'
      );
  }

  private async clear(
    manager: EntityManager,
    id: string,
    status: 'queued' | 'failed' | 'cancelled' | 'expired',
    failure: AccountExportFailure | null = null
  ) {
    await manager.query(
      'UPDATE identity_account_exports SET status = ?, leaseToken = NULL, leasedUntil = NULL, readyAt = NULL, artifact = NULL, failure = ? WHERE id = ?',
      [status, failure, id]
    );
    await manager.query(
      'DELETE FROM identity_account_export_chunks WHERE exportId = ?',
      [id]
    );
  }

  private async active(manager: EntityManager, uid: string, lock = false) {
    const identity = await readCanonicalIdentity(manager, uid, lock);
    assertActiveIdentity(identity);
    if (identity.kind !== 'user')
      throw new CanonicalIdentityAccessDenied(
        'A registered account is required'
      );
    const [account] = await manager.query<
      { registeredAt: string | number | null }[]
    >('SELECT registeredAt FROM identity_accounts WHERE identityId = ?', [uid]);
    if (!account || account.registeredAt === null)
      throw new CanonicalIdentityAccessDenied(
        'Complete registration before exporting account data'
      );
    canonicalSqlInteger(account.registeredAt, 1);
  }

  private async owned(
    manager: EntityManager,
    uid: string,
    id: string,
    lock = false
  ): Promise<AccountExportRow> {
    const [row] = await manager.query<Raw[]>(
      `SELECT * FROM identity_account_exports WHERE id = ? AND identityId = ?${
        lock ? ' FOR UPDATE' : ''
      }`,
      [accountExportId(id), uid]
    );
    if (!row)
      throw new CanonicalIdentityAccessDenied('Account export is unavailable');
    const parsed = accountExportFromSql(row);
    if (parsed.identityId !== uid)
      throw new AccountExportSourceInvalid('Account export identity mismatch');
    return parsed;
  }

  private async leased(
    manager: EntityManager,
    work: AccountExportWork,
    at: number
  ): Promise<boolean> {
    await this.active(manager, work.identityId, true);
    const row = await this.owned(manager, work.identityId, work.id, true);
    const current = Math.max(at, this.now());
    return (
      row.status === 'building' &&
      row.leaseToken === work.token &&
      row.attempts === work.attempts &&
      row.leasedUntil !== null &&
      row.leasedUntil > current &&
      row.expiresAt > current &&
      row.expiresAt === work.expiresAt
    );
  }
}
