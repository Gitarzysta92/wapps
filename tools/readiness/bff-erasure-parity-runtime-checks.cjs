const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { HeadObjectCommand } = require('@aws-sdk/client-s3');

async function until(read, matches, message) {
  let value;
  for (let attempt = 0; attempt < 400; attempt++) {
    value = await read();
    if (matches(value)) return value;
    await delay(100);
  }
  assert.fail(message + ': ' + JSON.stringify(value));
}

async function qualifyErasureParity(options) {
  const {
    call,
    origins,
    input,
    source,
    credentialSource,
    identities,
    operator,
    scoped,
    services,
    subjectFor,
    credentials,
    ingressSecret,
    root,
    accountMaintenance,
    restartAccount,
    restartBff,
    stopAccount,
    crashAccount,
    stopBff,
    stopAuth,
    restartAuth,
    pausePolicy,
    resumePolicy,
  } = options;
  const pass = (message) => console.log('PASS A28 ' + message);
  const evidence = {
    fences: [],
    inventories: [],
    roster: ['account', 'editorial', 'discussion'],
    credentialCleanup: 'independent Authentication service',
  };
  const binaries = [
    'dist/apps/services/editorial/main.js',
    'dist/sdk/features/discussion/applications/management/main.js',
    'dist/sdk/features/discussion/applications/materializer/main.js',
    'dist/sdk/features/identity/applications/management/main.js',
  ];
  const hashes = () =>
    Object.fromEntries(
      binaries.map((file) => [
        file,
        createHash('sha256')
          .update(readFileSync(path.join(root, file)))
          .digest('hex'),
      ])
    );
  const frozen = hashes();
  const enroll = async (label, at = origins[0]) => {
    const email = `erasure-${label}-${randomUUID()}@example.test`;
    const registered = await call('/auth/register', {
      at,
      body: { ...input, email },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const subject = await subjectFor(registered.uid);
    assert.notEqual(subject, registered.uid);
    await credentials.setOperatorClaims(subject, {
      roles: label === 'owner' ? ['admin'] : ['discussion:writer'],
    });
    const session = await call('/auth/signin', {
      at,
      body: { email, password: input.password },
    });
    const { publicId } = await call('/api/me/profile', {
      at,
      token: session.token,
    });
    return { ...session, subject, publicId, email };
  };
  const owner = await enroll('owner'),
    other = await enroll('other');
  const statusPath = (uid = owner.uid) =>
    `/api/admin/users/${uid}/deletion-status`;
  const status = (at = origins[0], uid = owner.uid) =>
    call(statusPath(uid), { at, token: operator.token });
  const job = async (table = 'identity_erasure_jobs', uid = owner.uid) =>
    (await source.query(`SELECT * FROM ${table} WHERE identityId=?`, [uid]))[0];
  const due = (table = 'identity_erasure_jobs', uid = owner.uid) =>
    source.query(
      `UPDATE ${table} SET availableAt=? WHERE identityId=? AND leaseToken IS NULL AND failedAt IS NULL AND completedAt IS NULL`,
      [Date.now(), uid]
    );
  const removed = async () => {
    const [record] = await credentialSource.query(
      'SELECT uid,email,password_salt,password_hash,disabled,deleted,claims_json,created_at,last_sign_in_at FROM local_credential_users WHERE uid=?',
      [owner.subject]
    );
    assert.equal(record.uid, owner.subject);
    assert.equal(Number(record.deleted), 1);
    assert.equal(Number(record.disabled), 1);
    assert.equal(record.email, null);
    assert.equal(record.password_salt, null);
    assert.equal(record.password_hash, null);
    assert.equal(Number(record.created_at), 0);
    assert.equal(record.last_sign_in_at, null);
    assert.deepEqual(
      typeof record.claims_json === 'string'
        ? JSON.parse(record.claims_json)
        : record.claims_json,
      {}
    );
    assert.deepEqual(
      await credentialSource.query(
        'SELECT 1 FROM local_credential_sessions WHERE uid=?',
        [owner.subject]
      ),
      []
    );
    assert.equal(
      Number(
        (
          await credentialSource.query(
            'SELECT deleted FROM local_credential_users WHERE uid=?',
            [other.subject]
          )
        )[0].deleted
      ),
      0
    );
    assert.equal(
      (await identities.credentialSubjects(owner.uid))[0].subject,
      owner.subject
    );
  };
  const fixture = await require('./erasure-parity-fixtures.cjs')({
    ...options,
    at: origins[0],
    owner,
    other,
    until,
  });
  // Staff setup is complete; the deletion journey uses an ordinary member session.
  await credentials.setOperatorClaims(owner.subject, {
    roles: ['discussion:writer'],
  });
  Object.assign(
    owner,
    await call('/auth/signin', {
      at: origins[0],
      body: { email: owner.email, password: input.password },
    })
  );
  for (const at of origins) {
    assert.equal(await status(at), null);
    await call('/api/me', { at, method: 'DELETE', status: 401 });
    await call('/api/me?identityId=' + other.uid, {
      at,
      token: owner.token,
      method: 'DELETE',
      status: 400,
    });
    await call('/api/me', {
      at,
      token: owner.token,
      method: 'DELETE',
      body: { identityId: other.uid },
      status: 400,
    });
    await call(statusPath(), { at, token: other.token, status: 403 });
    await call(statusPath(), { at, token: scoped.token, status: 403 });
    await call(statusPath(), {
      at,
      token: other.token,
      headers: {
        'X-Ingress-Auth': ingressSecret,
        'X-User-Id': operator.uid,
        'X-User-Claims': '{"roles":["admin"]}',
      },
      status: 403,
    });
  }
  await pausePolicy();
  try {
    await call(`/api/admin/users/${owner.uid}`, {
      at: origins[0],
      token: operator.token,
      method: 'DELETE',
      status: 503,
    });
  } finally {
    await resumePolicy();
  }
  assert.equal(await status(), null);
  await stopBff();
  try {
    for (const at of origins) {
      await call('/api/me', {
        at,
        token: owner.token,
        method: 'DELETE',
        status: 502,
      });
      await call(statusPath(), { at, token: operator.token, status: 502 });
    }
  } finally {
    await restartBff();
  }
  await restartBff({ ACCOUNT_MANAGEMENT_URL: 'http://127.0.0.1:1' });
  try {
    for (const at of origins)
      await call('/api/me', {
        at,
        token: owner.token,
        method: 'DELETE',
        status: 503,
      });
  } finally {
    await restartBff();
  }
  pass(
    'both gateway families enforce self/staff authority, reject injected identities and bodies, and fail closed on policy, BFF and Account outages without owner fallback'
  );

  const fenceWorkers = async () => {
    await services.stopWorker();
    await services.stopDiscussion();
    await services.stopEditorial();
    services.assertStopped();
    assert.deepEqual(
      hashes(),
      frozen,
      'Qualified artifacts changed before fencing'
    );
    evidence.fences.push({
      at: new Date().toISOString(),
      writersExited: true,
      materializerExited: true,
      frozen,
    });
  };
  await credentialSource.query(
    "CREATE TRIGGER qualification_credential_erasure BEFORE UPDATE ON local_credential_users FOR EACH ROW BEGIN IF NEW.deleted=1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected credential erasure failure'; END IF; END"
  );
  let credentialFault = true;
  try {
    await require('./account-erasure-runtime-checks.cjs')({
      root,
      accountSource: source,
      editorialSource: services.editorialSource,
      discussionEnv: services.discussionEnv,
      discussionDatabase: 'discussion',
      editorialDatabase: 'editorial',
      mongo: services.mongo,
      accountOrigin: () => services.editorialEnv.ACCOUNT_MANAGEMENT_URL,
      editorialOrigin: () => services.endpoints.EDITORIAL_URL,
      discussionOrigin: () => services.endpoints.DISCUSSION_URL,
      reviewOrigin: () => origins[0],
      restartAccount,
      restartEditorial: services.restartEditorial,
      restartDiscussion: services.restartDiscussion,
      stopDiscussion: services.stopDiscussion,
      resumeEditorial: services.restartEditorial,
      owner: owner.uid,
      other: other.uid,
      application: fixture.content.application,
      minimumOwnedResources: 3,
      headers: (uid) => ({
        'content-type': 'application/json',
        'x-ingress-auth': ingressSecret,
        'x-user-id': uid,
      }),
      writeDiscussion: (route, body, uid = owner.uid, method = 'POST') =>
        call('/api/' + route, {
          at: origins[0],
          token: uid === owner.uid ? owner.token : other.token,
          method,
          body,
          status: method === 'POST' ? 201 : 200,
          headers: { 'Idempotency-Key': randomUUID() },
        }),
      requestDeletion: () =>
        call('/api/me', {
          at: origins[0],
          token: owner.token,
          method: 'DELETE',
          status: 202,
        }),
      assertCredentialRemoved: removed,
      until,
      pass,
      fenceWorkers,
      recordInventory: (plan) => {
        assert.match(plan.fingerprint, /^[a-f0-9]{64}$/);
        evidence.inventories.push(plan);
      },
      assertRetiredObjects: async (objects) => {
        for (const { objectKey } of objects) {
          const object = await services.storage.send(
            new HeadObjectCommand({
              Bucket: 'discussion-content',
              Key: objectKey,
            })
          );
          assert.equal(object.ContentLength, 0, objectKey);
        }
      },
      afterAccepted: async (deletion) => {
        await until(
          () => job('identity_deletion_jobs'),
          (row) => row.attempts > 0 && row.leaseToken === null,
          'Credential failure did not schedule retry'
        );
        for (const at of origins) {
          assert.deepEqual(await status(at), deletion);
          await call('/api/me', { at, token: owner.token, status: 401 });
          await call('/api/me', {
            at,
            token: owner.token,
            method: 'DELETE',
            status: 401,
          });
        }
        assert.equal(
          Number(
            (
              await credentialSource.query(
                'SELECT deleted FROM local_credential_users WHERE uid=?',
                [owner.subject]
              )
            )[0].deleted
          ),
          0
        );
        await stopAuth();
        await credentialSource.query(
          'DROP TRIGGER qualification_credential_erasure'
        );
        credentialFault = false;
        const attempts = Number((await job('identity_deletion_jobs')).attempts);
        await due('identity_deletion_jobs');
        await until(
          () => job('identity_deletion_jobs'),
          (row) => Number(row.attempts) > attempts && row.leaseToken === null,
          'Authentication outage did not persist retry'
        );
        assert.equal(
          (await identities.findDeletion(owner.uid)).cleanup,
          'pending'
        );
        await restartAuth();
        await due('identity_deletion_jobs');
        pass(
          'canonical tombstone denies existing sessions while credential deletion fails; independent Authentication outage retries exact provider subject without global completion'
        );
      },
      afterCompletionFailure: async () => {
        assert.equal((await status()).cleanup, 'pending');
        // Exercise every real failed attempt; only the disposable retry clock is advanced.
        await until(
          async () => {
            await due();
            return job();
          },
          (row) => row.failedAt !== null,
          'Coordinator did not quarantine at its retry bound'
        );
        assert.equal(Number((await job()).attempts), 12);
        for (const at of origins)
          assert.equal((await status(at)).cleanup, 'failed');
        await restartAccount();
        assert.equal((await status()).cleanup, 'failed');
        const report = JSON.parse(
          (await accountMaintenance(['--erasure-status'])).stdout.trim()
        );
        assert.ok(
          report.failures.some(
            (failure) => failure.id === owner.uid && failure.attempts === 12
          )
        );
        await stopAccount();
        const requeue = JSON.parse(
          (
            await accountMaintenance(['--erasure-requeue', owner.uid])
          ).stdout.trim()
        );
        assert.deepEqual(requeue, { requeued: true, kind: 'erasure' });
        assert.equal(Number((await job()).attempts), 0);
        assert.equal(
          (await identities.findDeletion(owner.uid)).cleanup,
          'pending'
        );
        pass(
          'final receipt failure reaches the real 12-attempt quarantine, survives restart, reports failed through both BFF gateways and recovers only after compiled maintenance requeue'
        );
      },
    });
  } finally {
    if (credentialFault)
      await credentialSource.query(
        'DROP TRIGGER qualification_credential_erasure'
      );
    await restartAuth();
  }
  await fixture.verify(until);
  for (const at of origins) {
    assert.equal((await status(at)).cleanup, 'completed');
    const repeated = await call(`/api/admin/users/${owner.uid}`, {
      at,
      token: operator.token,
      method: 'DELETE',
      status: 202,
    });
    assert.deepEqual(repeated, await status(at));
  }
  pass(
    'complete erasure removes private profile/avatar/preferences/follows/badge provenance, notifications/watches/export artifacts and private media; independent approved suite and public image bytes survive, peer state stays intact'
  );

  await qualifyInvalidReceipts({
    ...options,
    enroll,
    status,
    job,
    due,
    until,
    pass,
    crashAccount,
  });
  assert.deepEqual(hashes(), frozen);
  if (process.env.WAPPS_ERASURE_OUTPUT) {
    mkdirSync(process.env.WAPPS_ERASURE_OUTPUT, { recursive: true });
    writeFileSync(
      path.join(process.env.WAPPS_ERASURE_OUTPUT, 'runtime-evidence.json'),
      JSON.stringify(evidence, null, 2) + '\n'
    );
  }
}

async function qualifyInvalidReceipts({
  call,
  origins,
  operator,
  services,
  restartAccount,
  stopAccount,
  crashAccount,
  enroll,
  status,
  job,
  due,
  until,
  pass,
}) {
  const owner = await enroll('receipt-probes', origins[1]);
  let mode = 'foreign',
    received;
  const fixture = createServer(async (request, response) => {
    let text = '';
    for await (const part of request) text += part;
    if (request.url !== '/api/internal/account-erasure') {
      response.writeHead(503).end();
      return;
    }
    const input = JSON.parse(text);
    if (input.identityId !== owner.uid) {
      response.writeHead(503).end();
      return;
    }
    received = input;
    if (mode === 'blocked') return;
    let receipt = { ...received, participant: 'editorial', state: 'completed' };
    if (mode === 'foreign') receipt.participant = 'discussion';
    if (mode === 'identity') receipt.identityId = operator.uid;
    if (mode === 'revision') receipt.revision++;
    if (mode === 'missing') delete receipt.state;
    if (mode === 'duplicate') receipt = [receipt, receipt];
    response
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(receipt));
  });
  fixture.listen(0, '127.0.0.1');
  await once(fixture, 'listening');
  const endpoint = {
    EDITORIAL_URL: `http://127.0.0.1:${fixture.address().port}`,
  };
  try {
    await services.restartEditorial({
      EDITORIAL_ERASURE_WORKERS_FENCED: 'true',
      EDITORIAL_MEDIA_CLEANUP_ENABLED: 'true',
    });
    await restartAccount(endpoint);
    const deletion = await call('/api/me', {
      at: origins[1],
      token: owner.token,
      method: 'DELETE',
      status: 202,
    });
    assert.equal(deletion.cleanup, 'pending');
    let previous = 0;
    for (mode of ['foreign', 'identity', 'revision', 'missing', 'duplicate']) {
      await due('identity_erasure_jobs', owner.uid);
      const retry = await until(
        () => job('identity_erasure_jobs', owner.uid),
        (row) => Number(row.attempts) > previous && row.leaseToken === null,
        'Invalid ' + mode + ' receipt was not rejected'
      );
      previous = Number(retry.attempts);
      assert.equal(retry.completedAt, null);
      assert.equal((await status(origins[1], owner.uid)).cleanup, 'pending');
    }
    mode = 'blocked';
    received = undefined;
    await due('identity_erasure_jobs', owner.uid);
    await until(
      async () => received,
      Boolean,
      'Coordinator did not reach blocked participant'
    );
    const before = await job('identity_erasure_jobs', owner.uid);
    assert.ok(before.leaseToken);
    await crashAccount();
    assert.deepEqual(await job('identity_erasure_jobs', owner.uid), before);
    fixture.closeAllConnections();
    await restartAccount();
    assert.equal((await status(origins[0], owner.uid)).cleanup, 'pending');
    assert.equal(
      (await job('identity_erasure_jobs', owner.uid)).leaseToken,
      before.leaseToken
    );
    await until(
      () => job('identity_erasure_jobs', owner.uid),
      (row) => row.completedAt !== null,
      'Expired crash lease did not recover'
    );
    for (const at of origins)
      assert.equal((await status(at, owner.uid)).cleanup, 'completed');
    pass(
      'alpha self-deletion rejects foreign/mismatched/missing/duplicate participant receipts; actual Account SIGKILL preserves the durable lease and real expiry recovers through the unchanged three-participant roster'
    );
  } finally {
    await stopAccount();
    fixture.closeAllConnections();
    await new Promise((resolve) => fixture.close(resolve));
    await restartAccount();
  }
}

module.exports = { qualifyErasureParity };
