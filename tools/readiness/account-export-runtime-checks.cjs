const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { gunzipSync } = require('node:zlib');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const net = require('node:net');
const admin = require('firebase-admin');
const { processService } = require('./qualification-process.cjs');
const {
  identityDataSource,
  MysqlCanonicalIdentities,
  MysqlAccountExports,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');

async function qualifyAccountExportRuntime(options) {
  const {
    root,
    source,
    sql,
    queuePort,
    mongoPort,
    endpoint,
    password,
    exportSecret,
    editorialOrigin,
    secret,
    opaBinary,
    owner,
    pass,
  } = options;
  const project = `demo-export-${randomUUID().slice(0, 12)}`;
  const emulator = '127.0.0.1:9099';
  const previousEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = emulator;
  const credentialApp = admin.initializeApp({ projectId: project }, project);
  const other = 'AccountExportOther';
  let accountSource, account, discussion, accountPolicy, discussionPolicy;
  const failures = [];
  const accountBinary = path.join(
    root,
    'dist/sdk/features/identity/applications/management/main.js'
  );
  const discussionBinary = path.join(
    root,
    'dist/sdk/features/discussion/applications/management/main.js'
  );
  const common = {
    ...process.env,
    NODE_ENV: 'test',
    MYSQL_HOST: sql.host,
    MYSQL_PORT: String(sql.port),
    MYSQL_USERNAME: sql.user,
    MYSQL_PASSWORD: password,
    QUEUE_HOST: '127.0.0.1',
    QUEUE_PORT: String(queuePort),
    QUEUE_USERNAME: 'wapps',
    QUEUE_PASSWORD: password,
    INGRESS_AUTH_SECRET: secret,
    EXPLORE_SERVICE_SECRET: 'qualification-explore-secret-2026-only',
    ACCOUNT_EXPORT_SOURCE_SECRET: exportSecret,
    ACCOUNT_ERASURE_SECRET: 'qualification-erasure-secret-2026-only',
    NOTIFICATION_SERVICE_SECRET: 'qualification-notification-secret-2026-only',
    EDITORIAL_URL: editorialOrigin(),
    MONGO_HOST: '127.0.0.1',
    MONGO_PORT: String(mongoPort),
    MONGO_USERNAME: 'wapps',
    MONGO_PASSWORD: password,
  };
  const discussionEnv = {
    ...common,
    MYSQL_DATABASE: 'export_discussion',
    DISCUSSION_DATABASE_HOST: sql.host,
    DISCUSSION_DATABASE_PORT: String(sql.port),
    DISCUSSION_DATABASE_USERNAME: sql.user,
    DISCUSSION_DATABASE_PASSWORD: password,
    DISCUSSION_DATABASE_NAME: 'export_discussion',
    DISCUSSION_STORAGE_HOST: endpoint,
    DISCUSSION_STORAGE_ACCESSKEY: 'qualification',
    DISCUSSION_STORAGE_SECRETKEY: password,
    MONGO_DATABASE: 'export_discussion',
    DISCUSSION_SEED_DEMO_DATA: 'false',
    DISCUSSION_PUBLIC_TENANT: 'default',
    DISCUSSION_PORT: '0',
    DISCUSSION_HOST: '127.0.0.1',
  };
  const accountEnv = {
    ...common,
    MYSQL_DATABASE: 'export_account',
    FIREBASE_PROJECT_ID: project,
    FIREBASE_WEB_API_KEY: 'local-placeholder',
    FIREBASE_AUTH_EMULATOR_HOST: emulator,
    ACCOUNT_MANAGEMENT_PORT: '0',
    ACCOUNT_MANAGEMENT_HOST: '127.0.0.1',
    OPA_TIMEOUT_MS: '500',
    REPLY_NOTIFICATION_WORKER_ENABLED: options.notifications ? 'true' : 'false',
    FAVORITE_UPDATE_WORKER_ENABLED: options.favoriteUpdates ? 'true' : 'false',
    MENTION_NOTIFICATION_WORKER_ENABLED: options.mentions ? 'true' : 'false',
  };
  // Mentions call in both directions; retain both origins through independent restarts.
  if (options.mentions) {
    const reservations = [net.createServer(), net.createServer()];
    try {
      for (const server of reservations)
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      discussionEnv.DISCUSSION_PORT = String(reservations[0].address().port);
      accountEnv.ACCOUNT_MANAGEMENT_PORT = String(
        reservations[1].address().port
      );
      discussionEnv.ACCOUNT_MANAGEMENT_URL = `http://127.0.0.1:${accountEnv.ACCOUNT_MANAGEMENT_PORT}`;
    } finally {
      for (const server of reservations)
        await new Promise((resolve) => server.close(resolve));
    }
  }
  async function policy(bundle) {
    const reservation = net.createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    return processService(
      opaBinary,
      [
        'run',
        '--server',
        '--addr',
        `127.0.0.1:${port}`,
        path.join(
          root,
          'sdk/features/identity/packages/infrastructure/opa/bundles',
          bundle
        ),
      ],
      { cwd: root },
      () => `http://127.0.0.1:${port}`,
      '/health'
    );
  }
  async function restartDiscussion() {
    await discussion?.stop();
    discussionEnv.EDITORIAL_URL = editorialOrigin();
    discussion = await processService(
      process.execPath,
      [discussionBinary],
      { cwd: root, env: discussionEnv },
      (log) =>
        log.match(/Discussion API is running on: (http:\/\/[^\s]+)\/api/)?.[1],
      '/api/health'
    );
    accountEnv.DISCUSSION_URL = discussion.origin;
  }
  async function restartAccount() {
    await account?.stop();
    accountEnv.EDITORIAL_URL = editorialOrigin();
    account = await processService(
      process.execPath,
      [accountBinary],
      { cwd: root, env: accountEnv },
      (log) =>
        log.match(
          /Account Management API is running on: (http:\/\/[^\s]+)\/api/
        )?.[1],
      '/api/health'
    );
  }
  const headers = (uid = owner) => ({
    'content-type': 'application/json',
    'x-user-id': uid,
    'x-user-claims': '{"roles":[],"tenantId":"default"}',
    'x-ingress-auth': secret,
  });
  const call = (
    route = '',
    method = 'GET',
    uid = owner,
    key = randomUUID(),
    body
  ) =>
    fetch(`${account.origin}/api/me/exports${route}`, {
      method,
      headers: { ...headers(uid), 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
  async function accepted(response, status = 200) {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  }
  async function until(read, matches, label) {
    let last;
    for (let attempt = 0; attempt < 200; attempt++) {
      last = await read();
      if (matches(last)) return last;
      await delay(100);
    }
    throw new Error(`${label}: ${JSON.stringify(last)}`);
  }
  const ready = (id) =>
    until(
      async () => accepted(await call(`/${id}`)),
      (job) => job.status === 'ready',
      'Archive did not become ready'
    );
  const request = async (key = randomUUID()) =>
    accepted(await call('', 'POST', owner, key, {}), 202);
  const cancel = async (id) => accepted(await call(`/${id}`, 'DELETE'));
  const chunks = async (id) =>
    Number(
      (
        await accountSource.query(
          'SELECT COUNT(*) AS total FROM identity_account_export_chunks WHERE exportId = ?',
          [id]
        )
      )[0].total
    );
  async function archive(job) {
    const response = await call(`/${job.id}/download`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('content-type'), 'application/gzip');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, job.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), job.sha256);
    const records = gunzipSync(bytes)
      .toString('utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.deepEqual(records[0].sources, [
      'account',
      'credentials',
      'editorial',
      'discussion',
    ]);
    assert.equal(records[0].identityId, owner);
    assert.equal(records.at(-1).type, 'complete');
    assert.deepEqual(
      records.at(-1).captures.map((row) => row.source),
      records[0].sources
    );
    for (const receipt of records.at(-1).captures)
      assert.equal(
        receipt.records,
        records.filter(
          (row) => row.type === 'record' && row.source === receipt.source
        ).length
      );
    const json = JSON.stringify(records);
    for (const value of [
      'Export runtime member',
      `${owner.toLowerCase()}@example.test`,
      'Reviewed application',
      'Runtime private discussion',
      'Runtime private discussion after edit',
    ])
      assert.ok(json.includes(value), value);
    for (const value of [
      'Foreign runtime private text',
      'never-export-runtime-claim',
      'passwordHash',
      'passwordSalt',
      'refreshToken',
      'StaffIdentityExcluded',
    ])
      assert.equal(json.includes(value), false, value);
    const versions = records
      .filter(
        (row) =>
          row.type === 'record' &&
          row.source === 'discussion' &&
          row.collection === 'payload-versions'
      )
      .map((row) => row.data);
    assert.equal(versions.length, 2);
    assert.ok(
      versions.some(
        (row) =>
          row.content === 'Runtime private discussion' &&
          row.current === false &&
          row.storage === 'present'
      )
    );
    assert.ok(
      versions.some(
        (row) =>
          row.content === 'Runtime private discussion after edit' &&
          row.current === true &&
          row.storage === 'present'
      )
    );
    return bytes;
  }
  try {
    for (const database of ['export_account', 'export_discussion'])
      await source.query(
        `CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
      );
    accountSource = identityDataSource(accountEnv);
    await accountSource.initialize();
    await accountSource.runMigrations({ transaction: 'none' });
    const identities = new MysqlCanonicalIdentities(accountSource);
    for (const uid of [owner, other]) {
      await credentialApp
        .auth()
        .createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
      await identities.ensure({
        uid,
        provider: 'email',
        kind: 'user',
        activate: true,
      });
      await identities.enrollAccount(
        uid,
        uid === owner ? 'Export runtime member' : 'Other runtime member',
        randomUUID()
      );
    }
    await credentialApp
      .auth()
      .setCustomUserClaims(owner, { internal: 'never-export-runtime-claim' });
    accountPolicy = await policy('identity-admin');
    discussionPolicy = await policy('discussion');
    accountEnv.OPA_URL = accountPolicy.origin;
    discussionEnv.OPA_URL = discussionPolicy.origin;
    execFileSync(process.execPath, [discussionBinary, '--migrate'], {
      cwd: root,
      env: discussionEnv,
      stdio: 'pipe',
      timeout: 30000,
    });
    await restartDiscussion();
    for (const [uid, content] of [
      [owner, 'Runtime private discussion'],
      [other, 'Foreign runtime private text'],
    ]) {
      const created = await accepted(
        await fetch(`${discussion.origin}/api/discussions`, {
          method: 'POST',
          headers: {
            ...headers(uid),
            'idempotency-key': randomUUID(),
            'x-user-claims': '{"roles":["admin"],"tenantId":"default"}',
          },
          body: JSON.stringify({
            content,
            state: 'draft',
            visibility: 'private',
          }),
          signal: AbortSignal.timeout(10000),
        }),
        201
      );
      if (uid === owner)
        await accepted(
          await fetch(`${discussion.origin}/api/discussions/${created.id}`, {
            method: 'PUT',
            headers: {
              ...headers(uid),
              'idempotency-key': randomUUID(),
              'x-user-claims': '{"roles":["admin"],"tenantId":"default"}',
            },
            body: JSON.stringify({
              expectedRevision: created.revision,
              content: 'Runtime private discussion after edit',
            }),
            signal: AbortSignal.timeout(10000),
          })
        );
    }
    await restartAccount();
    if (options.explore || options.digest || options.timeline || options.favoritesContentPreferences) {
      await require('./explore-runtime-checks.cjs')({ root, accountSource, editorialSource: source, discussionEnv, accountEnv, accountOrigin: () => account.origin, discussionOrigin: () => discussion.origin, editorialOrigin, restartDiscussion, restartAccount, stopDiscussion: () => discussion.stop(), headers, owner, other, until, browser: options.browser, digest: options.digest || options.timeline, timeline: options.timeline, favoritesContentPreferences: options.favoritesContentPreferences, output: options.output, pass });
      return { erased: false };
    }
    if (options.notifications || options.favoriteUpdates || options.mentions) {
      await require(options.mentions
        ? './mention-notification-runtime-checks.cjs'
        : options.favoriteUpdates
        ? './favorite-update-runtime-checks.cjs'
        : './reply-notification-runtime-checks.cjs')({
        root,
        accountSource,
        editorialSource: source,
        discussionEnv,
        accountEnv,
        accountOrigin: () => account.origin,
        discussionOrigin: () => discussion.origin,
        editorialOrigin,
        restartAccount,
        stopAccount: () => account.stop(),
        restartDiscussion,
        stopDiscussion: () => discussion.stop(),
        owner,
        other,
        headers,
        until,
        browser: options.browser,
        output: options.output,
        pass,
      });
      return { erased: false };
    }
    assert.deepEqual(await accepted(await call()), { job: null });
    const key = randomUUID(),
      first = await request(key);
    assert.equal((await request(key)).id, first.id);
    assert.equal((await call('', 'POST', owner, randomUUID(), {})).status, 409);
    assert.equal((await call(`/${first.id}`, 'GET', other)).status, 403);
    assert.equal(
      (await call(`/${first.id}/download`, 'GET', other)).status,
      403
    );
    assert.equal((await call(`/${first.id}`, 'DELETE', other)).status, 403);
    assert.equal((await call('?identityId=Other')).status, 400);
    const complete = await ready(first.id);
    const original = await archive(complete);
    await restartAccount();
    assert.equal((await accepted(await call())).job.id, first.id);
    assert.deepEqual(await archive(await ready(first.id)), original);
    const [stored] = await accountSource.query(
      'SELECT payload FROM identity_account_export_chunks WHERE exportId = ? AND position = 0',
      [first.id]
    );
    await accountSource.query(
      'UPDATE identity_account_export_chunks SET payload = ? WHERE exportId = ? AND position = 0',
      [Buffer.alloc(stored.payload.length), first.id]
    );
    assert.equal((await call(`/${first.id}/download`)).status, 503);
    await accountSource.query(
      'UPDATE identity_account_export_chunks SET payload = ? WHERE exportId = ? AND position = 0',
      [stored.payload, first.id]
    );
    assert.equal((await cancel(first.id)).status, 'cancelled');
    assert.equal(await chunks(first.id), 0);
    assert.equal((await request(key)).status, 'cancelled');
    pass(
      'Compiled Account pump builds and downloads all four real sources with verified gzip/receipts, exact request replay, conflict and owner isolation, private data exclusions, corruption rejection, cancellation and immutable restart recovery'
    );

    await discussion.stop();
    const retry = await request();
    await until(
      async () => accepted(await call(`/${retry.id}`)),
      (job) => job.status === 'queued' && job.attempts > 0,
      'Missing source did not schedule retry'
    );
    assert.equal((await call(`/${retry.id}/download`)).status, 409);
    await restartDiscussion();
    await restartAccount();
    const retried = await ready(retry.id);
    assert.ok(retried.attempts >= 2);
    await archive(retried);
    await cancel(retry.id);
    pass(
      'A real Discussion outage leaves the archive unavailable; durable retry survives Account restart and captures every source after recovery'
    );

    await account.stop();
    const store = new MysqlAccountExports(accountSource);
    const interrupted = await store.request(owner, randomUUID());
    const lease = await store.claim(Date.now(), randomUUID());
    assert.equal(lease.id, interrupted.id);
    assert.equal(
      await store.append(
        lease,
        0,
        Buffer.from('partial interrupted gzip'),
        Date.now()
      ),
      true
    );
    await delay(20);
    await accountSource.query(
      'UPDATE identity_account_exports SET leasedUntil = ? WHERE id = ?',
      [Date.now() - 1, interrupted.id]
    );
    await restartAccount();
    const recovered = await ready(interrupted.id);
    assert.equal(recovered.attempts, 2);
    await archive(recovered);
    await cancel(interrupted.id);
    pass(
      'A persisted interrupted lease and partial chunk recover through the compiled pump after restart; the next attempt replaces partial data and downloads a complete verified archive'
    );

    const expiring = await ready((await request()).id);
    const at = Date.now();
    await accountSource.query(
      'UPDATE identity_account_exports SET requestedAt = ?, availableAt = ?, expiresAt = ?, readyAt = ? WHERE id = ?',
      [at - 86_400_001, at - 86_400_001, at - 1, at - 2, expiring.id]
    );
    assert.equal(
      (await accepted(await call(`/${expiring.id}`))).status,
      'expired'
    );
    assert.equal((await call(`/${expiring.id}/download`)).status, 409);
    await until(
      () => chunks(expiring.id),
      (count) => count === 0,
      'Expired chunks were not purged'
    );

    const lock = source.createQueryRunner();
    await lock.connect();
    let cancelled;
    try {
      await lock.query('LOCK TABLES application_drafts WRITE');
      cancelled = await request();
      await until(
        async () => accepted(await call(`/${cancelled.id}`)),
        (job) => job.status === 'building',
        'Capture did not start'
      );
      assert.equal((await cancel(cancelled.id)).status, 'cancelled');
    } finally {
      await lock.query('UNLOCK TABLES');
      await lock.release();
    }
    await delay(1500);
    assert.equal(
      (await accepted(await call(`/${cancelled.id}`))).status,
      'cancelled'
    );
    assert.equal(await chunks(cancelled.id), 0);
    const restricted = await ready((await request()).id);
    await identities.setSuspended(owner, true);
    assert.equal((await call(`/${restricted.id}/download`)).status, 401);
    await identities.setSuspended(owner, false);
    await archive(restricted);
    await cancel(restricted.id);
    if (options.browser) {
      await require('./account-export-browser.cjs').qualifyAccountExportBrowser(
        {
          root,
          output: options.output,
          accountOrigin: () => account.origin,
          headers,
          owner,
          other,
          source,
          restartAccount,
          pass,
        }
      );
    }
    if (options.erasure) {
      await require('./account-erasure-runtime-checks.cjs')({
        root,
        accountSource,
        editorialSource: source,
        discussionEnv,
        accountOrigin: () => account.origin,
        discussionOrigin: () => discussion.origin,
        editorialOrigin,
        restartEditorial: options.restartEditorial,
        mongoPort,
        password,
        restartAccount,
        stopDiscussion: () => discussion.stop(),
        restartDiscussion,
        owner,
        headers,
        until,
        credentialApp,
        browser: options.browser,
        output: options.output,
        pass,
      });
    }
    await accountPolicy.stop();
    assert.equal(
      (await call('', 'GET', options.erasure ? other : owner)).status,
      503
    );
    pass(
      'Compiled runtime enforces archive expiry, in-flight cancellation without resurrection, current account lifecycle, purge and policy outage; elapsed expiry/lease times are accelerated only in disposable SQL fixtures'
    );
  } catch (error) {
    failures.push(error);
  } finally {
    for (const process of [
      account,
      discussion,
      accountPolicy,
      discussionPolicy,
    ])
      try {
        await process?.stop();
      } catch (error) {
        failures.push(error);
      }
    if (accountSource?.isInitialized)
      try {
        await accountSource.destroy();
      } catch (error) {
        failures.push(error);
      }
    try {
      await credentialApp.auth().deleteUsers([owner, other]);
    } catch (error) {
      failures.push(error);
    }
    await credentialApp.delete();
    if (previousEmulator === undefined)
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = previousEmulator;
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length)
    throw new AggregateError(failures, 'Account export qualification failed');
  return { erased: !!options.erasure };
}

module.exports = { qualifyAccountExportRuntime };
