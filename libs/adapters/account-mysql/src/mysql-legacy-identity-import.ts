import { createHash, randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  appendCanonicalIdentityEvent,
  canonicalIdentityState,
} from './canonical-account-sql';
import {
  legacyEvidenceHash,
  parseLegacyStubPlan,
} from './legacy-identity-plan';

/** Import only into a separately migrated, empty staging schema; retain all legacy stores. */
export async function importLegacyStubs(
  source: DataSource,
  input: unknown,
  approvedHash: string,
  now = Date.now
): Promise<{ imported: number; replayed: boolean }> {
  const plan = parseLegacyStubPlan(input),
    planHash = legacyEvidenceHash(plan);
  if (approvedHash !== planHash)
    throw new Error('Reviewed legacy plan hash does not match');
  if (await source.showMigrations())
    throw new Error('Run canonical migrations in the staging database first');
  const runner = source.createQueryRunner();
  await runner.connect();
  let acquired = false,
    lock = '';
  try {
    const [database]: { schemaName: string }[] = await runner.query(
      'SELECT DATABASE() AS schemaName'
    );
    if (!database?.schemaName || database.schemaName === plan.sourceDatabase)
      throw new Error('Legacy import requires a separate staging database');
    lock = `wapps-identity:${createHash('sha256')
      .update(database.schemaName)
      .digest('hex')
      .slice(0, 40)}`;
    const [owned]: { acquired: unknown }[] = await runner.query(
      'SELECT GET_LOCK(?, 10) AS acquired',
      [lock]
    );
    if (owned?.acquired !== 1 && owned?.acquired !== '1')
      throw new Error('Identity maintenance is already running');
    acquired = true;
    await runner.startTransaction('SERIALIZABLE');
    const receipts: {
      identityId: string;
      planHash: string;
      sourceHash: string;
    }[] = await runner.query(
      'SELECT identityId, planHash, sourceHash FROM identity_legacy_imports ORDER BY BINARY identityId LIMIT 1001 FOR UPDATE'
    );
    if (receipts.length) {
      if (
        receipts.length !== plan.identities.length ||
        receipts.some(
          (row, index) =>
            row.identityId !== plan.identities[index].identityId ||
            row.planHash !== planHash ||
            row.sourceHash !== plan.identities[index].sourceHash
        )
      )
        throw new Error('A different legacy import is already recorded');
      for (const row of receipts) {
        const [stored] = await runner.query(
          'SELECT * FROM identities WHERE claim = ? FOR UPDATE',
          [row.identityId]
        );
        if (
          !stored ||
          canonicalIdentityState(stored).identityId !== row.identityId ||
          stored.id !== row.identityId
        )
          throw new Error('Imported canonical identity is missing or changed');
      }
      await runner.commitTransaction();
      return { imported: receipts.length, replayed: true };
    }
    const tables: { name: string }[] = await runner.query(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
    );
    if (tables.length > 128)
      throw new Error('Staging table inventory exceeds its bound');
    for (const { name } of tables) {
      if (name === 'migrations') continue;
      if (name !== 'identities' && !/^identity_[a-z_]+$/.test(name))
        throw new Error('Staging database contains a foreign table');
      if (
        (await runner.query(`SELECT 1 FROM \`${name}\` LIMIT 1 FOR UPDATE`))
          .length
      )
        throw new Error('Legacy import requires an empty staging database');
    }
    const at = now();
    if (
      !Number.isSafeInteger(at) ||
      at < plan.capturedAt ||
      at > 8_640_000_000_000_000
    )
      throw new Error('Invalid legacy import time');
    for (const row of plan.identities) {
      await runner.query(
        `INSERT INTO identities (id, identity_id, claim, kind, provider_type, provider_secret, is_active, is_suspended, is_deleted, created_at, updated_at, deleted_at, revision)
        VALUES (?, ?, ?, 'user', 'legacy', NULL, 0, 1, 0, ?, ?, 0, 1)`,
        [row.identityId, row.identityId, row.identityId, row.createdAt, at]
      );
      const [stored] = await runner.query(
        'SELECT * FROM identities WHERE claim = ?',
        [row.identityId]
      );
      await appendCanonicalIdentityEvent(
        runner.manager,
        'identity.created',
        canonicalIdentityState(stored),
        at,
        randomUUID
      );
      await runner.query(
        'INSERT INTO identity_legacy_imports (identityId, planHash, sourceHash, importedAt) VALUES (?, ?, ?, ?)',
        [row.identityId, planHash, row.sourceHash, at]
      );
    }
    await runner.commitTransaction();
    return { imported: plan.identities.length, replayed: false };
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    try {
      if (acquired) await runner.query('SELECT RELEASE_LOCK(?)', [lock]);
    } finally {
      await runner.release();
    }
  }
}
