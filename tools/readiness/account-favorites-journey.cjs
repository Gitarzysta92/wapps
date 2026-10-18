/* Compiled account + Editorial HTTP, real OPA/SQL/Mongo; trusted ingress is a local fixture. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { createConnection } = require('mysql2/promise');
const {
  identityDataSource,
  MysqlCanonicalIdentities,
  MysqlAccountFavorites,
} = require('../../libs/adapters/account-mysql/src');
const { processService } = require('./qualification-process.cjs');

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}
const close = (server) =>
  new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );

async function accountFavoritesJourney({
  root,
  sql,
  editorialOrigin,
  discussionOrigin,
  catalogOrigin,
  createTarget,
  renameTarget,
  deleteTarget,
  publishTarget,
  hiddenTarget,
  suiteQualification,
  additionalQualification,
  ingressSecret,
  browser = process.env.WAPPS_FAVORITES_BROWSER === '1',
  output = process.env.WAPPS_FAVORITES_BROWSER_OUTPUT ??
    '/tmp/wapps-readiness/favorites-browser',
}) {
  const database = `favorites_${randomUUID().replaceAll('-', '')}`;
  const secret = ingressSecret ?? randomUUID();
  const admin = await createConnection(sql);
  const unavailable = net.createServer((socket) => socket.destroy());
  let unavailablePort;
  let created = false;
  let source;
  let account;
  let opa;
  const failures = [];
  try {
    unavailablePort = await listen(unavailable);
    const reservation = net.createServer();
    const opaPort = await listen(reservation);
    await close(reservation);
    await admin.query(
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
    );
    created = true;
    const env = {
      ...process.env,
      MYSQL_HOST: sql.host,
      MYSQL_PORT: String(sql.port),
      MYSQL_DATABASE: database,
      MYSQL_USERNAME: sql.user,
      MYSQL_PASSWORD: sql.password,
      QUEUE_HOST: '127.0.0.1',
      QUEUE_PORT: String(unavailablePort),
      QUEUE_USERNAME: 'fixture',
      QUEUE_PASSWORD: secret,
      FIREBASE_PROJECT_ID: 'demo-wapps-favorites',
      FIREBASE_WEB_API_KEY: 'local-placeholder',
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${unavailablePort}`,
      INGRESS_AUTH_SECRET: secret,
      ACCOUNT_EXPORT_SOURCE_SECRET: 'qualification-export-secret-2026-only',
      ACCOUNT_ERASURE_SECRET: 'qualification-erasure-secret-2026-only',
      NOTIFICATION_SERVICE_SECRET: 'qualification-notification-secret-2026-only',
      OPA_URL: `http://127.0.0.1:${opaPort}`,
      OPA_TIMEOUT_MS: '500',
      ACCOUNT_MANAGEMENT_PORT: '0',
      ACCOUNT_MANAGEMENT_HOST: '127.0.0.1',
      EDITORIAL_URL: editorialOrigin,
      DISCUSSION_URL: discussionOrigin ?? `http://127.0.0.1:${unavailablePort}`,
    };
    source = await identityDataSource(env).initialize();
    await source.runMigrations({ transaction: 'none' });
    const identities = new MysqlCanonicalIdentities(source);
    const favorites = new MysqlAccountFavorites(source);
    const alice = 'FavoritesApiAlice';
    const bob = 'FavoritesApiBob';
    for (const uid of [alice, bob])
      await identities.ensure({
        uid,
        kind: 'user',
        provider: 'email',
        activate: true,
      });
    opa = await processService(
      process.env.OPA_BINARY ?? 'opa',
      [
        'run',
        '--server',
        '--addr',
        `127.0.0.1:${opaPort}`,
        path.join(
          root,
          'sdk/features/identity/packages/infrastructure/opa/bundles/identity-admin'
        ),
      ],
      { cwd: root, env: process.env },
      () => env.OPA_URL,
      '/health'
    );
    const startAccount = () =>
      processService(
        process.execPath,
        [
          path.join(
            root,
            'dist/sdk/features/identity/applications/management/main.js'
          ),
        ],
        { cwd: root, env },
        (log) => log.match(/is running on: (http:\/\/[^\s]+)\/api/)?.[1],
        '/api/health'
      );
    account = await startAccount();
    const headers = (uid) => ({
      'content-type': 'application/json',
      'x-user-id': uid,
      'x-ingress-auth': secret,
      'x-user-claims': '{"roles":[]}',
    });
    const call = (uid = alice, body, key = randomUUID()) =>
      fetch(`${account.origin}/api/me/favorites`, {
        method: body ? 'PUT' : 'GET',
        headers: { ...headers(uid), 'idempotency-key': key },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(8000),
      });
    const read = async (uid = alice) => {
      const response = await call(uid);
      assert.equal(response.status, 200, await response.clone().text());
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return response.json();
    };
    const change = async (uid, body, key) => {
      const response = await call(uid, body, key);
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    assert.deepEqual(await read(), {
      identityId: alice,
      revision: 1,
      favorites: [],
    });
    const first = await createTarget('favorite-first');
    await publishTarget(first.id);
    const initial = {
      expectedRevision: 1,
      saved: true,
      target: { kind: 'applications', id: first.id },
    };
    assert.equal(
      (await fetch(`${account.origin}/api/me/favorites`)).status,
      401
    );
    assert.equal(
      (await call(alice, { ...initial, identityId: bob })).status,
      400
    );
    const receipt = await change(alice, initial, 'first-save');
    assert.deepEqual(receipt, { identityId: alice, revision: 2 });
    assert.deepEqual(await change(alice, initial, 'first-save'), receipt);
    assert.equal((await read()).favorites[0].id, first.id);
    assert.deepEqual((await read(bob)).favorites, []);
    for (const target of [
      { kind: 'applications', id: hiddenTarget },
      { kind: 'applications', id: randomUUID() },
      { kind: 'suites', id: randomUUID() },
    ])
      assert.equal(
        (await call(alice, { ...initial, expectedRevision: 2, target })).status,
        400
      );
    assert.equal((await read()).revision, 2);
    await renameTarget(first.id, 'favorite-renamed');
    assert.equal(
      (await call(alice, { ...initial, expectedRevision: 2 })).status,
      503,
      'Pending target projections must not produce accepted favorites'
    );
    assert.deepEqual(
      await change(alice, initial, 'first-save'),
      receipt,
      'Receipt replay must not depend on current target projection availability'
    );
    await publishTarget(first.id);
    const selected = await fetch(
      `${editorialOrigin}/api/catalog/app-selection?ids=${first.id}`
    );
    assert.equal((await selected.json()).items[0].slug, 'favorite-renamed');
    await deleteTarget(first.id, 2);
    assert.equal(
      (await read()).favorites[0].id,
      first.id,
      'Saved references do not copy or grant visibility to deleted content'
    );
    assert.equal(
      (await call(alice, { ...initial, expectedRevision: 2 })).status,
      400
    );
    assert.deepEqual(await change(alice, initial, 'first-save'), receipt);
    await identities.updateProfile(
      alice,
      {
        expectedRevision: 2,
        name: 'Favorites profile',
        bio: null,
        location: null,
        socialLinks: {},
      },
      'profile-edit'
    );
    assert.equal(
      (await call(alice, { ...initial, expectedRevision: 2, saved: false }))
        .status,
      409
    );
    await change(
      alice,
      { ...initial, expectedRevision: 3, saved: false },
      'remove-deleted'
    );
    assert.deepEqual((await read()).favorites, []);
    assert.deepEqual(await change(alice, initial, 'first-save'), receipt);
    assert.deepEqual(
      (await read()).favorites,
      [],
      'Old confirmed add cannot resurrect removed membership'
    );
    const second = await createTarget('favorite-persistent');
    await publishTarget(second.id);
    const next = {
      ...initial,
      expectedRevision: 4,
      target: { kind: 'applications', id: second.id },
    };
    const nextReceipt = await change(alice, next, 'second-save');
    await change(bob, { ...next, expectedRevision: 1 }, 'bob-save');
    const saved = await read();
    await account.stop();
    account = undefined;
    account = await startAccount();
    assert.deepEqual(
      await read(),
      saved,
      'Independent requests after API process restart restore saved relations'
    );
    for (const actionName of [
      'identity.favorites.read',
      'identity.favorites.update',
    ]) {
      const decision = await fetch(
        `${opa.origin}/v1/data/wapps/identity_admin/authz/allow`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: {
              identityId: alice,
              actionName,
              subject: { roles: ['admin'] },
              resource: { type: 'user', id: bob },
            },
          }),
          signal: AbortSignal.timeout(3000),
        }
      );
      assert.equal((await decision.json()).result, false);
    }
    const restartAccount = async (editorialUrl, discussionUrl) => {
      if (editorialUrl) env.EDITORIAL_URL = editorialUrl;
      if (discussionUrl) env.DISCUSSION_URL = discussionUrl;
      await account.stop();
      account = undefined;
      account = await startAccount();
    };
    await additionalQualification?.({
      accountOrigin: () => account.origin,
      headers,
      identities,
      favorites,
      source,
      restartAccount,
    });
    const suiteWorkflow = await suiteQualification?.({
      accountOrigin: () => account.origin,
      headers,
      identities,
      favorites,
      source,
      restartAccount,
    });
    if (browser) {
      await require('./account-favorites-browser.cjs').accountFavoritesBrowser({
        root,
        accountOrigin: () => account.origin,
        catalogOrigin,
        headers,
        identities,
        favorites,
        createTarget,
        renameTarget,
        deleteTarget,
        publishTarget,
        restartAccount,
        suiteWorkflow,
        output,
      });
    }
    env.EDITORIAL_URL = `http://127.0.0.1:${unavailablePort}`;
    await account.stop();
    account = undefined;
    account = await startAccount();
    assert.deepEqual(await read(), saved);
    assert.equal(
      (await call(alice, { ...next, expectedRevision: 5 })).status,
      503
    );
    assert.deepEqual(
      await change(alice, next, 'second-save'),
      nextReceipt,
      'Lost response retry survives target-service outage'
    );
    await change(
      alice,
      { ...next, expectedRevision: 5, saved: false },
      'remove-offline'
    );
    assert.deepEqual((await read()).favorites, []);
    const beforePolicyOutage = await favorites.read(alice);
    await opa.stop();
    opa = undefined;
    assert.equal((await call()).status, 503);
    assert.equal(
      (await call(alice, { ...next, expectedRevision: 6 })).status,
      503
    );
    assert.deepEqual(await favorites.read(alice), beforePolicyOutage);
    await identities.requestDeletion(alice);
    assert.equal((await call()).status, 401);
    assert.equal((await favorites.read(bob)).favorites[0].id, second.id);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM identity_favorites WHERE identityId = ?',
          [alice]
        )
      ).length,
      0
    );
    console.log(
      'Favorites HTTP: built account/Editorial, real OPA/SQL/Mongo, isolation, replay, target rename/delete/lag, shared profile revision, API restarts, offline removal and policy outage pass.'
    );
  } catch (error) {
    failures.push(error);
  } finally {
    for (const cleanup of [
      async () => account?.stop(),
      async () => opa?.stop(),
      async () => {
        if (source?.isInitialized) await source.destroy();
      },
      async () => {
        if (created) await admin.query(`DROP DATABASE \`${database}\``);
      },
      async () => admin.end(),
      async () => {
        if (unavailablePort) await close(unavailable);
      },
    ]) {
      try {
        await cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length)
    throw new AggregateError(
      failures,
      'Favorites qualification/cleanup failed'
    );
}

module.exports = { accountFavoritesJourney };
