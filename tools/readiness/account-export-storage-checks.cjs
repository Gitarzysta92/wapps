const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { DataSource } = require('typeorm');
const { MysqlAccountExports, AccountExports1791676832000 } = require('../../libs/adapters/account-mysql/src');
const { CompleteAccountExport, ACCOUNT_EXPORT_SOURCES } = require('../../libs/usecases/account/src');
const { ACCOUNT_EXPORT_LIMITS } = require('../../sdk/features/identity/core/src');
const { GzipAccountExportArchive } = require('../../sdk/features/identity/applications/management/service/src/app/infrastructure/account-export-archive');

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function qualifyAccountExportStorage({ source, configuration, identities }) {
  let at = Date.now();
  const uid = 'ExportMember', otherUid = 'ExportOther';
  for (const identityId of [uid, otherUid, 'ExportUnregistered']) {
    await identities.ensure({ uid: identityId, kind: 'user', provider: 'email', activate: true });
    if (identityId !== 'ExportUnregistered') await identities.enrollAccount(identityId, identityId, randomUUID());
  }
  const store = new MysqlAccountExports(source, () => at);
  let second = await new DataSource(configuration).initialize();
  let peer = new MysqlAccountExports(second, () => at);
  const runner = source.createQueryRunner(), migration = new AccountExports1791676832000();
  const media = randomBytes(650_000).toString('base64');
  // These fixtures qualify capture/storage mechanics; real owning-service readers are a separate gate.
  const sources = ACCOUNT_EXPORT_SOURCES.map(name => ({ name, async *capture(identityId, signal) {
    signal.throwIfAborted();
    yield { type: 'begin', source: name, at };
    yield { type: 'record', source: name, collection: 'qualification', data: { identityId, body: name === 'account' ? media : name } };
    yield { type: 'end', source: name, at, records: 1 };
  } }));
  const archive = new GzipAccountExportArchive(() => at);
  const worker = jobs => new CompleteAccountExport(jobs, sources, archive, randomUUID, () => at);
  const chunkCount = async id => Number((await source.query('SELECT COUNT(*) AS total FROM identity_account_export_chunks WHERE exportId = ?', [id]))[0].total);
  try {
    await migration.up(runner);
    assert.equal(await store.latest(uid), null);
    await assert.rejects(store.request('ExportUnregistered', 'key'), /registration/);
    await assert.rejects(store.request('exportmember', 'key'));
    const key = randomUUID();
    const requested = await Promise.all([store.request(uid, key), peer.request(uid, key)]);
    assert.deepEqual(requested[0], requested[1]);
    const first = requested[0];
    await assert.rejects(peer.request(uid, randomUUID()), /already exists/);
    await assert.rejects(store.inspect(otherUid, first.id));
    await assert.rejects(store.cancel(otherUid, first.id));
    await assert.rejects(collect(store.download(otherUid, first.id)));
    await assert.rejects(collect(store.download(uid, first.id)), /no longer available/);
    const claims = await Promise.all([store.claim(at, randomUUID()), peer.claim(at, randomUUID())]);
    const abandoned = claims.find(Boolean);
    assert.equal(claims.filter(Boolean).length, 1);
    const bytes = Buffer.alloc(ACCOUNT_EXPORT_LIMITS.chunkBytes, 42);
    assert.equal(await store.append(abandoned, 0, bytes, at), true);
    assert.equal(await store.append(abandoned, 0, bytes, at), true);
    await assert.rejects(store.append(abandoned, 0, Buffer.from([1]), at), /cannot be replaced/);
    await assert.rejects(store.append(abandoned, 2, bytes, at), /unordered/);
    assert.equal(await chunkCount(first.id), 1);
    at += ACCOUNT_EXPORT_LIMITS.leaseMs + 1;
    assert.equal(await worker(peer).once(), 'completed');
    assert.equal(await store.append(abandoned, 1, bytes, at), false);
    await store.failed(abandoned, 'source-unavailable', at, true);
    assert.equal((await store.inspect(uid, first.id)).status, 'ready');
    assert.equal((await store.inspect(uid, first.id)).attempts, 2);
    await second.destroy();
    second = await new DataSource(configuration).initialize();
    peer = new MysqlAccountExports(second, () => at);
    const ready = await peer.inspect(uid, first.id);
    const downloaded = await collect(peer.download(uid, first.id));
    assert.equal(downloaded.length, ready.bytes);
    assert.equal(createHash('sha256').update(downloaded).digest('hex'), ready.sha256);
    const records = gunzipSync(downloaded).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(records[2].data.body, media);
    assert.equal(records.at(-1).type, 'complete');
    assert.deepEqual(records.at(-1).captures.map(item => item.source), ACCOUNT_EXPORT_SOURCES);
    await migration.up(runner);
    const [stored] = await source.query('SELECT * FROM identity_account_export_chunks WHERE exportId = ? AND position = 0', [first.id]);
    await source.query('UPDATE identity_account_export_chunks SET payload = ? WHERE exportId = ? AND position = 0', [Buffer.alloc(stored.payload.length), first.id]);
    await assert.rejects(collect(peer.download(uid, first.id)), /chunk/);
    await assert.rejects(migration.up(runner), /chunk/);
    await source.query('UPDATE identity_account_export_chunks SET payload = ? WHERE exportId = ? AND position = 0', [stored.payload, first.id]);
    const [readyRow] = await source.query('SELECT artifact FROM identity_account_exports WHERE id = ?', [first.id]);
    const corrupted = typeof readyRow.artifact === 'string' ? JSON.parse(readyRow.artifact) : readyRow.artifact;
    corrupted.sha256 = '0'.repeat(64);
    await source.query('UPDATE identity_account_exports SET artifact = ? WHERE id = ?', [JSON.stringify(corrupted), first.id]);
    await assert.rejects(collect(peer.download(uid, first.id)), /digest/);
    await assert.rejects(migration.up(runner), /disagrees/);
    corrupted.sha256 = ready.sha256;
    await source.query('UPDATE identity_account_exports SET artifact = ? WHERE id = ?', [JSON.stringify(corrupted), first.id]);
    await source.query("CREATE TRIGGER fail_export_cleanup BEFORE DELETE ON identity_account_export_chunks FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected cleanup failure'");
    try {
      await assert.rejects(store.cancel(uid, first.id), /injected/);
      assert.equal((await store.inspect(uid, first.id)).status, 'ready');
      assert.ok(await chunkCount(first.id));
    } finally { await source.query('DROP TRIGGER fail_export_cleanup'); }
    await store.cancel(uid, first.id);
    assert.equal(await chunkCount(first.id), 0);
    assert.equal((await peer.request(uid, key)).status, 'cancelled', 'Exact cancelled command replay cannot create a new archive');
    await assert.rejects(collect(peer.download(uid, first.id)));

    const rollback = await store.request(uid, randomUUID());
    const lease = await store.claim(at, randomUUID());
    const artifact = await archive.build(uid, sources, (index, chunk) => store.append(lease, index, chunk, at), new AbortController().signal);
    await assert.rejects(async () => store.complete(lease, { ...artifact, captures: [] }, at));
    await source.query("CREATE TRIGGER fail_export_ready BEFORE UPDATE ON identity_account_exports FOR EACH ROW BEGIN IF NEW.status = 'ready' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected ready failure'; END IF; END");
    try {
      await assert.rejects(store.complete(lease, artifact, at), /injected/);
      assert.equal((await peer.inspect(uid, rollback.id)).status, 'building');
      await assert.rejects(collect(store.download(uid, rollback.id)));
    } finally { await source.query('DROP TRIGGER fail_export_ready'); }
    assert.equal(await store.complete(lease, artifact, at), true);
    const inFlight = peer.download(uid, rollback.id)[Symbol.asyncIterator]();
    assert.equal((await inFlight.next()).done, false);
    await store.cancel(uid, rollback.id);
    await assert.rejects(inFlight.next(), /no longer available/);

    const expiryKey = randomUUID(), expiring = await store.request(uid, expiryKey);
    assert.equal(await worker(store).once(), 'completed');
    at = expiring.expiresAt;
    await assert.rejects(collect(peer.download(uid, expiring.id)));
    assert.equal((await peer.inspect(uid, expiring.id)).status, 'expired');
    await Promise.all([store.purge(at), peer.purge(at)]);
    assert.equal(await chunkCount(expiring.id), 0);
    assert.equal((await peer.request(uid, expiryKey)).status, 'expired');

    const retry = await store.request(uid, randomUUID());
    const failingSources = sources.map(item => item.name !== 'editorial' ? item : { ...item, async *capture() { yield { type: 'begin', source: 'editorial', at }; throw new Error('source unavailable'); } });
    const failing = new CompleteAccountExport(store, failingSources, archive, randomUUID, () => at);
    assert.equal(await failing.once(), 'retry');
    assert.equal(await chunkCount(retry.id), 0);
    assert.equal((await store.inspect(uid, retry.id)).status, 'queued');
    assert.equal(await failing.once(), 'idle');
    at += 2001;
    assert.equal(await worker(peer).once(), 'completed');
    assert.equal((await store.inspect(uid, retry.id)).attempts, 2);
    await store.cancel(uid, retry.id);

    const exhausted = await store.request(uid, randomUUID());
    const exhaustedLease = await store.claim(at, randomUUID());
    await store.append(exhaustedLease, 0, Buffer.from([1]), at);
    await source.query('UPDATE identity_account_exports SET attempts = ? WHERE id = ?', [ACCOUNT_EXPORT_LIMITS.attempts, exhausted.id]);
    at += ACCOUNT_EXPORT_LIMITS.leaseMs + 1;
    await store.purge(at);
    assert.equal((await store.inspect(uid, exhausted.id)).status, 'failed');
    assert.equal(await chunkCount(exhausted.id), 0);
    assert.equal(await store.claim(at, randomUUID()), null);

    const inactive = await store.request(uid, randomUUID());
    await identities.setSuspended(uid, true);
    assert.equal(await store.claim(at, randomUUID()), null);
    await assert.rejects(store.inspect(uid, inactive.id), /Identity is unavailable/);
    await identities.setSuspended(uid, false);
    assert.equal((await store.inspect(uid, inactive.id)).failure, 'account-unavailable');
    assert.equal(await chunkCount(inactive.id), 0);

    const erased = await store.request(uid, randomUUID());
    assert.equal(await worker(store).once(), 'completed');
    const erasing = peer.download(uid, erased.id)[Symbol.asyncIterator]();
    assert.equal((await erasing.next()).done, false);
    await identities.requestDeletion(uid);
    await assert.rejects(erasing.next(), /Identity is unavailable/);
    await store.purge(at);
    assert.equal(await chunkCount(erased.id), 0);
    await assert.rejects(store.request(uid, randomUUID()), /Identity is unavailable/);
    await migration.up(runner);

    await source.query('ALTER TABLE identity_account_exports DROP INDEX export_command');
    try { await assert.rejects(migration.up(runner), /indexes/); }
    finally { await source.query('ALTER TABLE identity_account_exports ADD UNIQUE KEY export_command (identityId, commandKey)'); }
    await source.query('RENAME TABLE identity_account_export_chunks TO retained_export_chunks');
    try { await assert.rejects(migration.up(runner), /Applied account export table is missing/); }
    finally { await source.query('RENAME TABLE retained_export_chunks TO identity_account_export_chunks'); }
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving/);
    const quotaKey = randomUUID();
    for (let index = 0; index < ACCOUNT_EXPORT_LIMITS.requestsPerDay; index++) {
      const item = await store.request(otherUid, index === 0 ? quotaKey : randomUUID());
      await store.cancel(otherUid, item.id);
    }
    await assert.rejects(store.request(otherUid, randomUUID()), /request limit reached/);
    assert.equal((await store.request(otherUid, quotaKey)).status, 'cancelled');
    at += ACCOUNT_EXPORT_LIMITS.retentionMs;
    const refreshed = await store.request(otherUid, randomUUID());
    await store.cancel(otherUid, refreshed.id);
    console.log('Account export storage passed: real MySQL migration/reentry/corruption, self isolation, concurrent receipts/claims, immutable chunks, crash reclaim, complete gzip/digest, reconnect, failure cleanup/backoff, cancellation/expiry/erasure during downloads and transactional rollback. Source records are fixtures; complete owning-service capture/API/browser export remains unqualified.');
  } finally {
    await runner.release();
    if (second?.isInitialized) await second.destroy();
  }
}
module.exports = { qualifyAccountExportStorage };
