const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const {
  MysqlCanonicalIdentities,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');

// Shares only the disposable services created by account-export-runtime-checks.
module.exports = async function qualifyAccountErasureRuntime(options) {
  const {
    accountSource,
    editorialSource,
    discussionEnv,
    accountOrigin,
    discussionOrigin,
    editorialOrigin,
    restartAccount,
    stopDiscussion,
    restartDiscussion,
    owner,
    headers,
    until,
    credentialApp,
    pass,
  } = options;
  const discussionSource = await new DataSource({
    type: 'mysql',
    host: discussionEnv.MYSQL_HOST,
    port: Number(discussionEnv.MYSQL_PORT),
    username: discussionEnv.MYSQL_USERNAME,
    password: discussionEnv.MYSQL_PASSWORD,
    database: discussionEnv.MYSQL_DATABASE,
    entities: [],
    synchronize: false,
  }).initialize();
  try {
    const finishDiscussion =
      await require('./discussion-erasure-runtime-checks.cjs')({
        ...options,
        discussionSource,
      });
    await stopDiscussion();
    const response = await fetch(`${accountOrigin()}/api/me`, {
      method: 'DELETE',
      headers: headers(owner),
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 202);
    const deletion = await response.json();
    assert.equal(deletion.cleanup, 'pending');
    const job = async () =>
      (
        await accountSource.query(
          'SELECT * FROM identity_erasure_jobs WHERE identityId = ?',
          [owner]
        )
      )[0];
    await until(
      job,
      (row) => row?.attempts > 0 && row.leaseToken === null,
      'Discussion outage did not leave durable erasure retry'
    );
    for (const source of [accountSource, editorialSource]) {
      const [request] = await source.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
        [owner]
      );
      assert.equal(Number(request.revision), deletion.revision);
      if (source === accountSource) assert.ok(request.completedAt);
      else assert.equal(request.completedAt, null);
    }
    await until(
      async () =>
        (
          await accountSource.query(
            'SELECT completedAt FROM identity_deletion_jobs WHERE identityId = ?',
            [owner]
          )
        )[0],
      (row) => row.completedAt !== null,
      'Credential removal did not finish'
    );
    await assert.rejects(
      credentialApp.auth().getUser(owner),
      (error) => error.code === 'auth/user-not-found'
    );
    assert.equal(
      (await new MysqlCanonicalIdentities(accountSource).requestDeletion(owner))
        .cleanup,
      'pending'
    );
    for (const table of [
      'identity_accounts',
      'identity_account_commands',
      'identity_account_exports',
      'identity_profile_avatars',
    ]) {
      const rows = await accountSource.query(
        `SELECT 1 FROM ${table} WHERE identityId = ? LIMIT 1`,
        [owner]
      );
      assert.deepEqual(rows, [], `Completed Account cleanup retained ${table}`);
    }
    pass(
      'Real Account DELETE activates available owning-service barriers during Discussion outage; Account private data completes locally but credential deletion cannot report full erasure complete'
    );

    await restartDiscussion();
    await restartAccount();
    await until(
      async () =>
        (
          await discussionSource.query(
            'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
            [owner]
          )
        )[0],
      (row) => row && Number(row.revision) === deletion.revision,
      'Discussion did not accept durable erasure after restart'
    );
    await until(
      job,
      (row) => row.attempts === 0 && row.leaseToken === null,
      'Accepted cleanup did not defer normally'
    );
    const input = { identityId: owner, revision: deletion.revision };
    for (const [name, origin, source] of [
      ['editorial', editorialOrigin(), editorialSource],
      ['discussion', discussionOrigin(), discussionSource],
    ]) {
      const invoke = (
        body = input,
        query = '',
        credential = discussionEnv.ACCOUNT_ERASURE_SECRET
      ) =>
        fetch(`${origin}/api/internal/account-erasure${query}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-account-erasure-writer': credential,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
      const before = await source.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
        [owner]
      );
      const replay = await invoke();
      assert.equal(replay.status, 202);
      assert.deepEqual(await replay.json(), {
        ...input,
        participant: name,
        state: 'pending',
      });
      assert.equal(
        (await invoke({ ...input, revision: input.revision + 1 })).status,
        409
      );
      assert.equal((await invoke(input, '?tenantId=other')).status, 400);
      assert.equal(
        (await invoke(input, '', discussionEnv.ACCOUNT_EXPORT_SOURCE_SECRET))
          .status,
        401
      );
      assert.deepEqual(
        await source.query(
          'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
          [owner]
        ),
        before
      );
    }
    const denied = await fetch(`${discussionOrigin()}/api/discussions`, {
      method: 'POST',
      headers: {
        ...headers(owner),
        'idempotency-key': 'after-erasure',
        'x-user-claims': '{"roles":["admin"],"tenantId":"default"}',
      },
      body: JSON.stringify({
        content: 'Must not be stored',
        state: 'draft',
        visibility: 'private',
      }),
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(denied.status, 403);
    await restartDiscussion();
    await restartAccount();
    assert.equal(
      (await new MysqlCanonicalIdentities(accountSource).requestDeletion(owner))
        .cleanup,
      'pending'
    );
    for (const source of [accountSource, editorialSource, discussionSource]) {
      const [request] = await source.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId = ?',
        [owner]
      );
      if (source === accountSource) assert.ok(request.completedAt);
      else assert.equal(request.completedAt, null);
    }
    pass(
      'Compiled Account -> Editorial/Discussion service authentication, real OPA, durable replay/conflict, resumed requests and post-erasure write denial survive API restart; cleanup truthfully remains pending'
    );
    await finishDiscussion(input);
    await require('./account-erasure-completion-checks.cjs')({
      ...options,
      discussionSource,
      input,
      job,
    });
    if (options.browser)
      await require('./account-erasure-browser.cjs')(options);
  } finally {
    await discussionSource.destroy();
  }
};
