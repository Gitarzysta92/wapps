/* Compiled identity APIs, real Firebase emulator and OPA, disposable canonical SQL. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const admin = require('firebase-admin');
const { processService } = require('./qualification-process.cjs');
const {
  emailVerificationBrowser,
} = require('./email-verification-browser.cjs');

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

async function emailVerificationJourney({
  root,
  source,
  identities,
  configuration,
}) {
  const output =
    process.env.WAPPS_EMAIL_VERIFICATION_OUTPUT ??
    '/tmp/wapps-readiness/email-verification-portal';
  fs.mkdirSync(output, { recursive: true });
  const project = process.env.IDENTITY_TEST_FIREBASE_PROJECT ?? 'demo-wapps';
  const firebasePort = Number(process.env.IDENTITY_TEST_FIREBASE_PORT ?? 9099);
  assert.match(project, /^[a-zA-Z0-9-]{1,100}$/);
  assert.ok(
    Number.isInteger(firebasePort) && firebasePort > 0 && firebasePort <= 65535
  );
  const emulator = `http://127.0.0.1:${firebasePort}`;
  const secret = randomUUID();
  const unavailableBroker = net.createServer((socket) => socket.destroy());
  const queuePort = await listen(unavailableBroker);
  const reserve = net.createServer();
  const authPort = await listen(reserve);
  await close(reserve);
  const reserveOpa = net.createServer();
  const opaPort = await listen(reserveOpa);
  await close(reserveOpa);
  let providerOffline = false;
  const providerProxy = http.createServer(async (req, res) => {
    try {
      if (providerOffline) {
        res.writeHead(503).end('{}');
        return;
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        assert.ok(body.length <= 32768);
      }
      const headers = { ...req.headers };
      delete headers.host;
      delete headers['content-length'];
      const upstream = await fetch(`${emulator}${req.url}`, {
        method: req.method,
        headers,
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(5000),
      });
      res
        .writeHead(upstream.status, { 'content-type': 'application/json' })
        .end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.writeHead(503).end('{}');
    }
  });
  const providerPort = await listen(providerProxy);
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
    FIREBASE_PROJECT_ID: project,
    FIREBASE_WEB_API_KEY: project,
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${providerPort}`,
    INGRESS_AUTH_SECRET: secret,
    ACCOUNT_EXPORT_SOURCE_SECRET: 'qualification-export-secret-2026-only',
    ACCOUNT_ERASURE_SECRET: 'qualification-erasure-secret-2026-only',
    NOTIFICATION_SERVICE_SECRET: 'qualification-notification-secret-2026-only',
    OPA_URL: `http://127.0.0.1:${opaPort}`,
    OPA_TIMEOUT_MS: '500',
    ACCOUNT_MANAGEMENT_PORT: '0',
    ACCOUNT_MANAGEMENT_HOST: '127.0.0.1',
    PORT: String(authPort),
    EDITORIAL_URL: 'http://127.0.0.1:1',
    DISCUSSION_URL: 'http://127.0.0.1:1',
    ENABLE_EMAIL_PASSWORD: 'true',
    ENABLE_GOOGLE: 'false',
    ENABLE_GITHUB: 'false',
    ENABLE_ANONYMOUS: 'false',
  };
  let auth, account, opa, portal, adminApp;
  const users = [];
  const evidence = [];
  const failures = [];
  const previousEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const startAuth = () =>
    processService(
      process.execPath,
      [
        path.join(
          root,
          'dist/sdk/features/identity/applications/authenticator/main.js'
        ),
      ],
      { cwd: root, env },
      () => `http://127.0.0.1:${authPort}`,
      '/auth/methods'
    );
  const call = async (endpoint, body, token) => {
    const response = await fetch(`${auth.origin}${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    return { status: response.status, headers: response.headers, data };
  };
  async function codeFor(email, requestType = 'VERIFY_EMAIL') {
    const response = await fetch(
      `${emulator}/emulator/v1/projects/${project}/oobCodes`,
      { signal: AbortSignal.timeout(5000) }
    );
    assert.equal(response.ok, true);
    const data = await response.json();
    const code = data.oobCodes
      .filter(
        (value) => value.email === email && value.requestType === requestType
      )
      .at(-1);
    assert.ok(code, 'A real provider action code must exist');
    return code.oobCode;
  }
  try {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${firebasePort}`;
    adminApp = admin.initializeApp(
      { projectId: project },
      `verification-${randomUUID()}`
    );
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
      { cwd: root },
      () => env.OPA_URL,
      '/health'
    );
    account = await processService(
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
    auth = await startAuth();
    for (const nickname of ['Alice', 'Bob', 'Suspended']) {
      const email = `verify-${randomUUID()}@example.test`;
      const result = await call('/auth/register', {
        email,
        nickname,
        password: 'Local-password-123',
        passwordConfirmation: 'Local-password-123',
      });
      assert.equal(result.status, 200, 'Integrated registration must succeed');
      users.push({ ...result.data, email, nickname });
    }
    const [alice, bob, suspended] = users;
    const status = await call(
      '/auth/email-verification/status',
      undefined,
      alice.token
    );
    assert.equal(status.status, 200);
    assert.equal(status.headers.get('cache-control'), 'no-store');
    assert.deepEqual(status.data, { email: alice.email, verified: false });
    assert.equal((await call('/auth/email-verification/status')).status, 401);
    assert.equal(
      (await call('/auth/email-verification/request', {}, 'invalid')).status,
      401
    );
    const optional = await call('/validate-optional', undefined, 'invalid');
    assert.equal(optional.status, 401);
    assert.equal(optional.headers.has('x-anonymous'), false);
    assert.equal(optional.headers.has('x-ingress-auth'), false);
    assert.equal((await call('/validate-optional')).data.anonymous, true);
    const foreign = await call(
      `/auth/email-verification/status?uid=${bob.uid}`,
      undefined,
      alice.token
    );
    assert.equal(foreign.data.email, alice.email);
    evidence.push(
      'Registration, self status, no-store, missing/invalid sessions, target isolation and optional ingress rejection'
    );
    await call('/auth/email-verification/request', {}, suspended.token);
    const suspendedCode = await codeFor(suspended.email);
    await identities.setSuspended(suspended.uid, true);
    assert.equal(
      (
        await call(
          '/auth/email-verification/status',
          undefined,
          suspended.token
        )
      ).status,
      401
    );
    assert.equal(
      (await call('/auth/email-verification/request', {}, suspended.token))
        .status,
      401
    );
    assert.equal(
      (await call('/auth/email-verification/complete', { code: suspendedCode }))
        .status,
      200
    );
    assert.equal((await identities.find(suspended.uid)).isSuspended, true);
    assert.equal(
      (
        await call(
          '/auth/email-verification/status',
          undefined,
          suspended.token
        )
      ).status,
      401
    );
    const orphan = await adminApp.auth().createUser({
      email: `orphan-${randomUUID()}@example.test`,
      password: 'Local-password-123',
    });
    users.push(orphan);
    const raw = await fetch(
      `${emulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${project}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: orphan.email,
          password: 'Local-password-123',
          returnSecureToken: true,
        }),
      }
    );
    const orphanSession = await raw.json();
    assert.equal(
      (
        await call(
          '/auth/email-verification/status',
          undefined,
          orphanSession.idToken
        )
      ).status,
      401
    );
    evidence.push(
      'SQL suspension, credential completion without activation, and rejection of an unenrolled Firebase user'
    );
    portal = await emailVerificationBrowser({
      root,
      output,
      authOrigin: () => auth.origin,
      accountOrigin: () => account.origin,
      secret,
      alice,
      bob,
      codeFor,
      providerOutage: (value) => {
        providerOffline = value;
      },
      restart: async () => {
        await auth.stop();
        auth = await startAuth();
      },
    });
    assert.deepEqual(
      (await call('/auth/email-verification/status', undefined, alice.token))
        .data,
      { email: alice.email, verified: true }
    );
    assert.equal(
      (await call('/auth/email-verification/request', {}, alice.token)).data
        .outcome,
      'already-verified'
    );
    evidence.push(
      'Independent browser verification, lost completion response, live refresh using an older token, restart and provider outage'
    );
    await adminApp.auth().updateUser(bob.uid, { disabled: true });
    assert.equal(
      (await call('/auth/email-verification/status', undefined, bob.token))
        .status,
      401
    );
    await adminApp.auth().updateUser(bob.uid, { disabled: false });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await adminApp.auth().revokeRefreshTokens(bob.uid);
    assert.equal(
      (await call('/auth/email-verification/request', {}, bob.token)).status,
      401
    );
    assert.equal(
      (await call('/validate-optional', undefined, bob.token)).status,
      401
    );
    evidence.push(
      'Firebase disabled and revoked sessions fail without anonymous ingress authority'
    );
    const outbox = await source.query(
      'SELECT body FROM identity_events_outbox'
    );
    assert.ok(outbox.every((row) => !String(row.body).includes(alice.token)));
    fs.writeFileSync(
      path.join(output, 'service-evidence.json'),
      JSON.stringify(
        {
          evidence,
          provider: 'localhost Firebase Auth emulator',
          persistence: 'disposable MySQL 8.4',
          broker:
            'deliberately unavailable; no email notification event delivery claimed',
        },
        null,
        2
      )
    );
    console.log(
      `Email verification: ${evidence.length} service groups and independent-browser journey passed.`
    );
  } catch (error) {
    failures.push(error);
  } finally {
    const results = await Promise.allSettled([
      portal?.close(),
      auth?.stop(),
      account?.stop(),
      opa?.stop(),
      close(providerProxy),
      close(unavailableBroker),
    ]);
    if (adminApp) {
      results.push(
        ...(await Promise.allSettled(
          users.map((user) => adminApp.auth().deleteUser(user.uid))
        ))
      );
      results.push(...(await Promise.allSettled([adminApp.delete()])));
    }
    if (previousEmulator === undefined)
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = previousEmulator;
    const failed = results.filter((value) => value.status === 'rejected');
    failures.push(...failed.map((value) => value.reason));
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      'Verification qualification or cleanup failed'
    );
}
module.exports = { emailVerificationJourney };
