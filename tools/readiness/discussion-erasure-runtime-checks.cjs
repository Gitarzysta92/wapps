const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { MongoClient } = require('mongodb');

// Prepare contributions before Account deletion, then qualify the compiled participant.
module.exports = async function prepareDiscussionErasure(options) {
  const {
    root,
    discussionSource: source,
    discussionEnv: env,
    discussionOrigin,
    restartDiscussion,
    restartAccount,
    accountSource,
    editorialSource,
    owner,
    headers,
    until,
    pass,
  } = options;
  assert.equal(source.options.database, 'export_discussion');
  const other = 'AccountExportOther';
  const write = async (route, body, uid = owner, method = 'POST') => {
    const response = await fetch(`${discussionOrigin()}/api/${route}`, {
      method,
      headers: {
        ...headers(uid),
        'idempotency-key': randomUUID(),
        'x-user-claims': '{"roles":["admin"],"tenantId":"default"}',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(
      response.status,
      method === 'POST' ? 201 : 200,
      await response.clone().text()
    );
    return response.json();
  };
  const publicRoot = await write('discussions', {
    content: {
      displayName: 'Runtime erased author',
      text: 'Retained public contribution',
    },
    state: 'published',
    visibility: 'public',
  });
  const reply = await write(
    `discussions/${publicRoot.id}/comments`,
    {
      content: {
        displayName: 'Surviving peer',
        text: 'Independent reply survives',
      },
    },
    other
  );
  const [application] = await editorialSource.query(
    'SELECT id FROM app_records WHERE slug=?',
    ['export-application']
  );
  assert.ok(application);
  const reviewBase = `application-reviews/${application.id}`;
  const publish = (uid, expectedRevision, text) =>
    write(
      `${reviewBase}/mine`,
      {
        expectedRevision,
        content: {
          displayName:
            uid === owner ? 'Runtime erased reviewer' : 'Surviving reviewer',
          rating: 4,
          text,
        },
      },
      uid,
      'PUT'
    );
  const firstReview = await publish(owner, 0, 'Private historical review text');
  const publicReview = await publish(
    owner,
    firstReview.revision,
    'Retained anonymous rating'
  );
  const helpful = await write(
    `${reviewBase}/${publicReview.id}/helpful`,
    {
      expectedRevision: publicReview.revision,
      helpful: true,
    },
    other,
    'PUT'
  );
  await write(
    `${reviewBase}/${publicReview.id}/reports`,
    {
      expectedRevision: helpful.revision,
      reason: 'Historical report on erased author',
    },
    other
  );
  const peerReview = await publish(other, 0, 'Independent peer review');
  const ownHelpful = await write(
    `${reviewBase}/${peerReview.id}/helpful`,
    {
      expectedRevision: peerReview.revision,
      helpful: true,
    },
    owner,
    'PUT'
  );
  await write(`${reviewBase}/${peerReview.id}/reports`, {
    expectedRevision: ownHelpful.revision,
    reason: 'Private erased actor report',
  });
  const originalObjects = await source.query(
    'SELECT objectKey FROM discussion_payload_objects WHERE ownerIdentityId=?',
    [owner]
  );
  const otherNodes = await source.query(
    'SELECT * FROM discussion_write_nodes WHERE ownerIdentityId=? ORDER BY nodeId',
    [other]
  );
  const binary = path.join(
    root,
    'dist/sdk/features/discussion/applications/management/main.js'
  );
  const mongoClient = () =>
    new MongoClient(
      `mongodb://${encodeURIComponent(env.MONGO_USERNAME)}:${encodeURIComponent(
        env.MONGO_PASSWORD
      )}@${env.MONGO_HOST}:${env.MONGO_PORT}`
    );
  const project = async () => {
    const mongo = mongoClient();
    const materializer = path.join(
      root,
      'dist/sdk/features/discussion/applications/materializer/main.js'
    );
    const worker = spawn(process.execPath, [materializer], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let diagnostic = '',
      spawnError;
    worker.on('error', (error) => {
      spawnError = error;
    });
    for (const stream of [worker.stdout, worker.stderr])
      stream.on('data', (bytes) => {
        diagnostic = (diagnostic + bytes).slice(-8000);
      });
    try {
      await mongo.connect();
      execFileSync(process.execPath, [materializer, '--rebuild'], {
        cwd: root,
        env,
        stdio: 'pipe',
        timeout: 30000,
      });
      const heads = mongo
        .db(env.MONGO_DATABASE)
        .collection('discussion_generation_heads');
      const expected = await source.query(
        'SELECT id,revision FROM discussion_write_aggregates'
      );
      await until(
        async () => {
          if (
            spawnError ||
            worker.exitCode !== null ||
            worker.signalCode !== null
          )
            throw new Error('Materializer stopped: ' + diagnostic);
          return Promise.all(
            expected.map((row) =>
              heads.findOne({
                _id: row.id,
                revision: Number(row.revision),
                schemaVersion: 3,
              })
            )
          );
        },
        (rows) => rows.every(Boolean),
        'Compiled materializer did not converge'
      );
    } finally {
      if (
        !spawnError &&
        worker.exitCode === null &&
        worker.signalCode === null
      ) {
        const stopped = once(worker, 'exit');
        worker.kill('SIGTERM');
        const timer = setTimeout(() => worker.kill('SIGKILL'), 5000);
        try {
          await stopped;
        } finally {
          clearTimeout(timer);
        }
      }
      await mongo.close();
    }
  };
  await project();

  return async function finish(input) {
    const invoke = async (body = input) => {
      const response = await fetch(
        `${discussionOrigin()}/api/internal/account-erasure`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-account-erasure-writer': env.ACCOUNT_ERASURE_SECRET,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        }
      );
      return { status: response.status, body: await response.json() };
    };
    const receipt = async () =>
      (
        await source.query(
          'SELECT * FROM identity_erasure_requests WHERE identityId=?',
          [owner]
        )
      )[0];
    assert.equal((await invoke()).status, 202);
    assert.equal(
      (
        await source.query(
          'SELECT ownerIdentityId FROM discussion_write_nodes WHERE nodeId=?',
          [publicRoot.id]
        )
      )[0].ownerIdentityId,
      owner,
      'Default-off activation must preserve pending content'
    );
    env.DISCUSSION_ERASURE_WORKERS_FENCED = 'true';
    await restartDiscussion();
    await restartAccount();
    assert.equal(
      (await invoke()).status,
      503,
      'Missing inventory must block cleanup'
    );
    assert.equal((await receipt()).completedAt, null);
    const inventory = (...args) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [binary, '--inventory-payloads', ...args],
          { cwd: root, env, encoding: 'utf8', timeout: 30000 }
        )
          .trim()
          .split('\n')
          .findLast((line) => line.startsWith('{'))
      );
    for (let page = 0; page < 64; page++) {
      const plan = inventory();
      const result = inventory(
        '--apply',
        plan.fingerprint,
        '--legacy-writers-stopped'
      );
      if (result.progress.completedAt !== null) break;
      assert.ok(page < 63, 'Inventory did not finish');
    }

    const mongo = mongoClient();
    try {
      await mongo.connect();
      const database = mongo.db(env.MONGO_DATABASE);
      const nodes = database.collection('discussion_generation_nodes');
      const legacy = database.collection('discussion_nodes');
      const old = await nodes.findOne({ _id: publicRoot.id });
      assert.ok(old);
      await nodes.insertOne({ ...old, _id: randomUUID(), schemaVersion: 2 });
      await legacy.insertOne({
        _id: randomUUID(),
        payload: 'Historical private payload',
      });

      for (let step = 0; step < 80; step++) {
        const result = await invoke();
        assert.equal(result.status, 202, JSON.stringify(result));
        const [remaining] = await source.query(
          'SELECT COUNT(*) n FROM discussion_payload_objects WHERE ownerIdentityId=? OR actorIdentityId=?',
          [owner, owner]
        );
        if (Number(remaining.n) === 0) break;
        assert.ok(step < 79, 'Canonical and private cleanup did not drain');
      }
      assert.equal((await receipt()).completedAt, null);
      assert.ok(
        (
          await source.query(
            'SELECT 1 FROM discussion_erasure_nodes WHERE identityId=?',
            [owner]
          )
        ).length,
        'Projection lag must retain durable targets'
      );
      assert.equal((await invoke()).status, 202);
      assert.equal(
        (await nodes.findOne({ _id: publicRoot.id })).ownerIdentityId,
        owner
      );
      await restartDiscussion();
      await restartAccount();
      assert.equal(
        (await invoke()).status,
        202,
        'API restart must retain projection wait'
      );
      await source.query(`CREATE TRIGGER qualification_erasure_completion BEFORE UPDATE ON identity_erasure_requests FOR EACH ROW
        BEGIN IF NEW.completedAt IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected completion failure'; END IF; END`);
      try {
        await project();
        let failed = false;
        for (let step = 0; step < 40; step++) {
          const result = await invoke();
          if (result.status === 503) {
            failed = true;
            break;
          }
          assert.equal(result.status, 202, JSON.stringify(result));
        }
        assert.ok(failed, 'Final receipt failure was not exercised');
        assert.equal((await receipt()).completedAt, null);
        assert.deepEqual(
          await source.query(
            'SELECT 1 FROM discussion_erasure_nodes WHERE identityId=?',
            [owner]
          ),
          []
        );
        assert.equal(await legacy.countDocuments({}), 0);
        assert.equal(
          await nodes.countDocuments({ schemaVersion: { $ne: 3 } }),
          0
        );
      } finally {
        await source.query('DROP TRIGGER qualification_erasure_completion');
      }
      const results = await Promise.all([invoke(), invoke(), invoke()]);
      for (const result of results) {
        assert.equal(result.status, 200, JSON.stringify(result));
        assert.deepEqual(result.body, {
          ...input,
          participant: 'discussion',
          state: 'completed',
        });
      }
      const completed = await receipt();
      assert.ok(completed.completedAt);
      assert.equal(
        (await invoke({ ...input, revision: input.revision + 1 })).status,
        409
      );
      await restartDiscussion();
      await restartAccount();
      assert.equal((await invoke()).status, 200);
      assert.deepEqual(
        await receipt(),
        completed,
        'Replay must preserve the first completion'
      );
      assert.deepEqual(
        await source.query(
          'SELECT * FROM discussion_write_nodes WHERE ownerIdentityId=? ORDER BY nodeId',
          [other]
        ),
        otherNodes
      );
      const current = await nodes.findOne({ _id: publicRoot.id });
      assert.equal(current.ownerIdentityId, null);
      assert.equal(
        current.payload.content.text,
        'Retained public contribution'
      );
      assert.equal(current.payload.content.displayName, undefined);
      assert.ok(await nodes.findOne({ _id: reply.id, ownerIdentityId: other }));
      for (const original of originalObjects) {
        const [stored] = await source.query(
          'SELECT ownerIdentityId,actorIdentityId,state FROM discussion_payload_objects WHERE objectKey=?',
          [original.objectKey]
        );
        assert.deepEqual(stored, {
          ownerIdentityId: null,
          actorIdentityId: null,
          state: 'retired',
        });
      }
      const response = await fetch(
        `${discussionOrigin()}/api/discussions/${publicRoot.id}`,
        { signal: AbortSignal.timeout(10000) }
      );
      assert.equal(response.status, 200);
      const retained = await response.text();
      assert.ok(retained.includes('Retained public contribution'));
      assert.ok(retained.includes('Independent reply survives'));
      assert.ok(!retained.includes('Runtime erased author'));
      const reviewResponse = await fetch(
        `${discussionOrigin()}/api/${reviewBase}/${publicReview.id}`
      );
      assert.equal(reviewResponse.status, 200);
      const retainedReview = await reviewResponse.text();
      assert.ok(retainedReview.includes('Deleted account'));
      assert.ok(retainedReview.includes('Retained anonymous rating'));
      assert.ok(!retainedReview.includes('Runtime erased reviewer'));
      assert.deepEqual(
        await source.query(
          'SELECT displayName,rating,text FROM review_versions WHERE reviewId=?',
          [publicReview.id]
        ),
        [
          {
            displayName: 'Deleted account',
            rating: 4,
            text: 'Retained anonymous rating',
          },
        ]
      );
      assert.deepEqual(
        await source.query(
          'SELECT 1 FROM review_reports WHERE reviewId IN (?,?)',
          [publicReview.id, peerReview.id]
        ),
        []
      );
      assert.deepEqual(
        await source.query(
          'SELECT reviewId,actorId FROM review_helpful WHERE reviewId IN (?,?)',
          [publicReview.id, peerReview.id]
        ),
        [{ reviewId: publicReview.id, actorId: other }]
      );
      assert.equal(
        (
          await source.query('SELECT ownerId FROM member_reviews WHERE id=?', [
            peerReview.id,
          ])
        )[0].ownerId,
        other
      );
      await until(
        async () =>
          (
            await accountSource.query(
              'SELECT * FROM identity_erasure_jobs WHERE identityId=?',
              [owner]
            )
          )[0],
        (row) => row?.leaseToken === null && row?.attempts === 0,
        'Account coordinator did not accept resumed participant completion'
      );
      assert.equal(
        (
          await accountSource.query(
            'SELECT completedAt FROM identity_erasure_jobs WHERE identityId=?',
            [owner]
          )
        )[0].completedAt,
        null,
        'Editorial must still prevent full erasure completion'
      );
      pass(
        'Compiled Discussion participant: activation/inventory gates, anonymous public discussions/reviews and peer replies/helpful marks, private payload/history/actor-interaction cleanup, projection-lag wait, partial API restart, historical cache cleanup, final SQL failure/retry and concurrent exact completion; Account remains pending for Editorial'
      );
    } finally {
      await mongo.close();
    }
  };
};
