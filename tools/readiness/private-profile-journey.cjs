/* Built account API + real OPA + disposable MySQL. Ingress credentials are local test substitutions. */
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { processService } = require('./qualification-process.cjs');
const { privateProfileBrowser } = require('./private-profile-browser.cjs');
const {
  qualifyAccountPreferencesHttp,
} = require('./account-preferences-qualification.cjs');

async function listener(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}
async function close(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

async function privateProfileJourney({
  root,
  source,
  identities,
  configuration,
}) {
  const secret = randomUUID();
  const unavailableBroker = net.createServer((socket) => socket.destroy());
  const queuePort = await listener(unavailableBroker);
  const reservation = net.createServer();
  const opaPort = await listener(reservation);
  await close(reservation);
  let opa;
  let account;
  let portal;
  let audienceProxy;
  let badgePolicyHook;
  const failures = [];
  const env = {
    ...process.env,
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: String(configuration.port),
    MYSQL_DATABASE: configuration.database,
    MYSQL_USERNAME: configuration.username,
    MYSQL_PASSWORD: configuration.password,
    QUEUE_HOST: '127.0.0.1',
    QUEUE_PORT: String(queuePort),
    QUEUE_USERNAME: 'qualification',
    QUEUE_PASSWORD: secret,
    FIREBASE_PROJECT_ID: 'demo-wapps-profile',
    FIREBASE_WEB_API_KEY: 'local-placeholder',
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${queuePort}`,
    INGRESS_AUTH_SECRET: secret,
    ACCOUNT_EXPORT_SOURCE_SECRET: 'qualification-export-secret-2026-only',
    ACCOUNT_ERASURE_SECRET: 'qualification-erasure-secret-2026-only',
    NOTIFICATION_SERVICE_SECRET: 'qualification-notification-secret-2026-only',
    OPA_URL: `http://127.0.0.1:${opaPort}`,
    OPA_TIMEOUT_MS: '500',
    ACCOUNT_MANAGEMENT_PORT: '0',
    EDITORIAL_URL: 'http://127.0.0.1:1',
    DISCUSSION_URL: 'http://127.0.0.1:1',
    ACCOUNT_MANAGEMENT_HOST: '127.0.0.1',
  };
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
  const headers = (uid) => ({
    'content-type': 'application/json',
    'x-user-id': uid,
    'x-ingress-auth': secret,
    'x-user-claims': '{"roles":[]}',
  });
  const call = (
    uid,
    method = 'GET',
    body,
    key = randomUUID(),
    endpoint = '/api/me/profile'
  ) =>
    fetch(`${account.origin}${endpoint}`, {
      method,
      headers: { ...headers(uid), 'idempotency-key': key },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });
  try {
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
    for (const uid of ['BrowserAlice', 'BrowserBob']) {
      await identities.ensure({
        uid,
        provider: 'email',
        kind: 'user',
        activate: true,
      });
      await identities.enrollAccount(
        uid,
        uid === 'BrowserAlice' ? 'Alice Browser' : 'Bob Browser',
        'browser-enrollment'
      );
    }
    await identities.ensure({
      uid: 'BrowserStub',
      provider: 'github',
      kind: 'user',
      activate: true,
    });
    if (process.env.WAPPS_PROFILE_BADGES_ONLY === '1') {
      audienceProxy = http.createServer(async (request, response) => {
        try {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const body = Buffer.concat(chunks);
          const upstream = await fetch(`${opa.origin}${request.url}`, {
            method: request.method,
            headers: { 'content-type': 'application/json' },
            ...(body.length ? { body } : {}),
            signal: AbortSignal.timeout(5000),
          });
          const payload = Buffer.from(await upstream.arrayBuffer());
          if (
            badgePolicyHook &&
            body.length &&
            JSON.parse(body.toString()).input?.action === 'read-badges'
          ) {
            const hook = badgePolicyHook;
            badgePolicyHook = null;
            await hook();
          }
          response.writeHead(upstream.status, {
            'content-type': 'application/json',
          });
          response.end(payload);
        } catch {
          response.writeHead(503);
          response.end('{}');
        }
      });
      env.OPA_URL = `http://127.0.0.1:${await listener(audienceProxy)}`;
      await source.query('DELETE FROM migrations WHERE name = ?', [
        'ProfileBadges1791676831000',
      ]);
      await assert.rejects(
        startAccount(),
        /Run identity --migrate before starting services/,
        'Normal API startup must refuse a pending badge migration'
      );
      const migrate = await promisify(execFile)(
        process.execPath,
        [
          path.join(
            root,
            'dist/sdk/features/identity/applications/management/main.js'
          ),
          '--migrate',
        ],
        { cwd: root, env, timeout: 30000 }
      );
      assert.match(migrate.stdout, /ProfileBadges1791676831000/);
      assert.equal(await source.showMigrations(), false);
      console.log(
        'Badge migration deployment: normal startup refuses pending migrations; built Account --migrate validates and preserves populated badge history.'
      );
    }
    account = await startAccount();
    if (process.env.WAPPS_PROFILE_BADGES_ONLY === '1') {
      const badgeHttp =
        await require('./profile-badges-http.cjs').qualifyProfileBadgesHttp({
          accountOrigin: () => account.origin,
          headers,
          identities,
          duringBadgePolicy: (hook) => {
            badgePolicyHook = hook;
          },
        });
      portal = await privateProfileBrowser({
        root,
        accountOrigin: () => account.origin,
        headers,
        identities,
        source,
        output:
          process.env.WAPPS_PROFILE_BROWSER_OUTPUT ??
          '/tmp/wapps-readiness/profile-badges-browser',
      });
      await account.stop();
      await portal.unavailable();
      account = await startAccount();
      await badgeHttp.restored();
      await portal.recovered();
      await opa.stop();
      await badgeHttp.policyUnavailable();
      console.log(
        'Badge journey: built Account, real OPA/MySQL, immutable audit, privacy, independent portal sessions, exact retry, restart and policy failure passed.'
      );
    } else {
      const photos =
        await require('./profile-avatars-http.cjs').qualifyProfileAvatarsHttp({
          accountOrigin: () => account.origin,
          headers,
          identities,
        });
      const publicProfiles =
        await require('./public-profiles-http.cjs').qualifyPublicProfilesHttp({
          accountOrigin: () => account.origin,
          opaOrigin: opa.origin,
          headers,
          identities,
        });
      const preferences = await qualifyAccountPreferencesHttp({
        accountOrigin: () => account.origin,
        opaOrigin: opa.origin,
        headers,
        identities,
      });
      const originalResponse = await call('BrowserAlice');
      assert.equal(originalResponse.status, 200);
      assert.equal(originalResponse.headers.get('cache-control'), 'no-store');
      const original = await originalResponse.json();
      assert.equal(original.identityId, 'BrowserAlice');
      const edit = {
        expectedRevision: original.revision,
        name: 'Alice saved',
        bio: 'Durable profile biography',
        location: 'Warsaw',
        socialLinks: { github: '@alice', website: 'https://example.test' },
      };
      const key = randomUUID();
      const saved = await call('BrowserAlice', 'PUT', edit, key);
      assert.equal(saved.status, 200);
      const receipt = await saved.json();
      assert.equal(receipt.revision, original.revision + 1);
      const retry = await call('BrowserAlice', 'PUT', edit, key);
      assert.deepEqual(await retry.json(), receipt);
      assert.equal((await call('BrowserAlice', 'PUT', edit)).status, 409);
      assert.equal(
        (
          await call('BrowserAlice', 'PUT', {
            ...edit,
            identityId: 'BrowserBob',
          })
        ).status,
        400
      );
      const bob = await (await call('BrowserBob')).json();
      assert.equal(bob.profile.name, 'Bob Browser');
      assert.equal(
        (await fetch(`${account.origin}/api/me/profile`)).status,
        401
      );
      const denied = await fetch(
        `${opa.origin}/v1/data/wapps/identity_admin/authz/allow`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: {
              identityId: 'BrowserAlice',
              actionName: 'identity.profile.update',
              subject: { roles: ['admin'] },
              resource: { type: 'user', id: 'BrowserBob' },
            },
          }),
        }
      );
      assert.equal((await denied.json()).result, false);
      await account.stop();
      account = await startAccount();
      await preferences.restored();
      await photos.restored();
      await publicProfiles.restored();
      assert.equal(
        (await (await call('BrowserAlice')).json()).profile.name,
        'Alice saved'
      );
      const pending = await source.query(
        "SELECT body FROM identity_events_outbox WHERE identityId = 'BrowserAlice' AND deliveredAt IS NULL"
      );
      assert.equal(
        pending.length,
        3,
        'Broker outage must retain every committed invalidation'
      );
      assert.ok(
        pending.every((row) => !row.body.includes('Durable profile biography'))
      );
      portal = await privateProfileBrowser({
        root,
        accountOrigin: () => account.origin,
        headers,
        identities,
        source,
        output:
          process.env.WAPPS_PROFILE_BROWSER_OUTPUT ??
          '/tmp/wapps-readiness/private-profile-browser',
      });
      await account.stop();
      await portal.unavailable();
      account = await startAccount();
      await portal.recovered();
      await preferences.restored();
      await photos.restored();
      await opa.stop();
      await preferences.policyUnavailable();
      await photos.policyUnavailable();
      await publicProfiles.policyUnavailable();
      assert.equal(
        (await call('BrowserAlice')).status,
        503,
        'A policy outage must fail closed'
      );
      assert.equal(
        (
          await call('BrowserAlice', 'PUT', {
            ...edit,
            expectedRevision: (
              await identities.getProfile('BrowserAlice')
            ).revision,
          })
        ).status,
        503
      );
      console.log(
        'Profile journey: built API, real OPA/MySQL, independent accounts, durable retries, policy denial/outage, retained outbox and process restart pass.'
      );
      console.log(
        process.env.WAPPS_PROFILE_AVATARS_ONLY === '1'
          ? 'Private photo portal and preference HTTP regression: real policy, upload/read/removal, account isolation, exact retries, process restart and fail-closed outage pass.'
          : 'Account preferences: real policy, API portal, independent accounts, durable saves/retries, process restart and fail-closed outage pass.'
      );
    }
  } catch (error) {
    console.error('Private profile qualification failed:', error);
    failures.push(error);
  } finally {
    const results = await Promise.allSettled([
      portal?.close(),
      account?.stop(),
      opa?.stop(),
      audienceProxy ? close(audienceProxy) : undefined,
      close(unavailableBroker),
    ]);
    failures.push(
      ...results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)
    );
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      'Profile qualification or cleanup failed'
    );
}

module.exports = { privateProfileJourney };
