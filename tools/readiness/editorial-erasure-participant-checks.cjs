const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const base = '../../apps/services/editorial/src/app/';
const {
  MysqlEditorialErasureCompletion,
  EDITORIAL_ERASURE_IDENTITY_COLUMNS,
} = require(base + 'account-erasure/mysql-editorial-erasure-completion');
const { EditorialErasureCompletion1791840014000 } = require(base +
  'account-erasure/editorial-erasure-completion.migration');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');
const { EditorialCommands } = require(base + 'application/editorial-commands');
const { MysqlEditorialWrites } = require(base +
  'infrastructure/mysql-editorial-writes');

module.exports = async function editorialErasureParticipantChecks(context) {
  const {
    source,
    owner,
    pass,
    origin,
    erasureSecret,
    restart,
    restartWith,
    environment,
    reader,
    projections,
  } = context;
  const input = { identityId: owner.identityId, revision: 11 };
  const completion = new MysqlEditorialErasureCompletion(source);
  const post = async (
    body = input,
    headers = { 'x-account-erasure-writer': erasureSecret }
  ) => {
    const response = await fetch(origin() + '/api/internal/account-erasure', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 401)
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return { status: response.status, value: await response.json() };
  };
  await assert.rejects(
    completion.state(input),
    /Missing Editorial erasure request/
  );
  await assert.rejects(
    completion.complete(input),
    /Missing Editorial erasure request/
  );
  assert.equal((await post(input, {})).status, 401);
  assert.equal(
    (await post(input, { 'x-account-erasure-writer': 'wrong' })).status,
    401
  );
  assert.equal(
    (
      await post(input, {
        'x-account-erasure-writer': erasureSecret,
        'x-user-id': owner.identityId,
      })
    ).status,
    401
  );
  assert.equal((await post({ ...input, revision: 0 })).status, 400);
  assert.equal(
    (
      await source.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId=?',
        [owner.identityId]
      )
    ).length,
    0
  );
  await restartWith({ EDITORIAL_ERASURE_WORKERS_FENCED: 'invalid' }).then(
    () => assert.fail('Invalid erasure activation must prevent startup'),
    (error) =>
      assert.match(String(error), /Invalid EDITORIAL_ERASURE_WORKERS_FENCED/)
  );
  await restartWith({
    EDITORIAL_ERASURE_WORKERS_FENCED: 'false',
    OPA_URL: 'http://127.0.0.1:1',
  });
  assert.equal((await post()).status, 503);
  assert.equal(
    (
      await source.query(
        'SELECT * FROM identity_erasure_requests WHERE identityId=?',
        [owner.identityId]
      )
    ).length,
    0
  );
  await restartWith({ OPA_URL: environment.OPA_URL });
  const commands = new EditorialCommands(
    new MysqlEditorialWrites(source, 'default'),
    context.policy,
    { generate: randomUUID }
  );
  for (const kind of ['category', 'tag'])
    await commands.create(
      kind,
      { name: `Retained ${kind}`, slug: `participant-${kind}` },
      { ...owner, roles: ['editorial:taxonomy'] },
      randomUUID()
    );
  // Reuse real publication/upload/review fixtures; their direct phase drivers are intentionally not invoked.
  await require('./editorial-audit-erasure-checks.cjs')(context);
  await require('./editorial-workspace-erasure-checks.cjs')(context);
  const columns = await source.query(
    'SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName,DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION'
  );
  const identityColumns = columns
    .filter((c) =>
      [
        'ownerIdentityId',
        'actorIdentityId',
        'claimantIdentityId',
        'reviewerIdentityId',
      ].includes(c.columnName)
    )
    .map((c) => [c.tableName, c.columnName]);
  assert.deepEqual(
    EDITORIAL_ERASURE_IDENTITY_COLUMNS.filter(([, c]) => c !== 'identityId')
      .map((x) => x.join('.'))
      .sort(),
    identityColumns.map((x) => x.join('.')).sort(),
    'Completion must cover every Editorial SQL owner/actor/reviewer column'
  );
  for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS) {
    const indexes = await source.query(
      "SELECT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? AND SEQ_IN_INDEX=1 AND SUB_PART IS NULL AND IS_VISIBLE='YES' AND COLLATION='A'",
      [table, column]
    );
    assert.ok(
      indexes.length,
      `${table}.${column} must have a full leading index`
    );
  }
  const samples = new Map();
  const capture = async () => {
    for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS) {
      const key = `${table}.${column}`;
      if (samples.has(key)) continue;
      const [row] = await source.query(
        `SELECT * FROM ${table} WHERE ${column}=? LIMIT 1`,
        [owner.identityId]
      );
      if (row) samples.set(key, row);
    }
  };
  await capture();
  const initialRows = async () => {
    const result = {};
    for (const table of new Set(
      EDITORIAL_ERASURE_IDENTITY_COLUMNS.map(([t]) => t)
    ))
      result[table] = await source.query(`SELECT * FROM ${table}`);
    return result;
  };
  const before = await initialRows();
  assert.equal((await post()).status, 202);
  assert.equal((await post()).value.state, 'pending');
  assert.deepEqual(await initialRows(), before);
  assert.equal(await completion.complete(input), 'pending');
  assert.equal(
    (await post({ ...input, revision: input.revision + 1 })).status,
    409
  );
  await assert.rejects(
    completion.complete({ ...input, revision: input.revision + 1 }),
    /exact erasure request/
  );
  pass(
    'compiled erasure endpoint denies missing/mixed credentials, invalid requests and policy outage; invalid activation prevents startup; disabled cleanup creates/replays only a pending barrier and preserves all content'
  );

  return async function erase() {
    const ownedResources = await source.query(
      'SELECT resourceKind,resourceId FROM editorial_resource_states WHERE ownerIdentityId=?',
      [owner.identityId]
    );
    const oldProjections = await Promise.all(
      ownedResources.map(async (r) =>
        projectEditorialSnapshot(
          await reader.read(r.resourceKind, r.resourceId)
        )
      )
    );
    for (const projection of oldProjections)
      await projections.publish(projection);
    const peers = [];
    for (const table of [
      'application_submissions',
      'suite_submissions',
      'article_submissions',
      'release_submissions',
      'application_ownership_claims',
      'application_ownership_decisions',
    ]) {
      const column =
        table === 'application_ownership_decisions'
          ? 'actorIdentityId'
          : 'reviewerIdentityId';
      const pk = await source.query(
        "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX",
        [table]
      );
      for (const row of await source.query(
        `SELECT * FROM ${table} WHERE ${column}=?`,
        [owner.identityId]
      ))
        peers.push({ table, column, pk: pk.map((x) => x.name), row });
    }
    await restartWith({ EDITORIAL_ERASURE_WORKERS_FENCED: 'true' });
    await source.query(
      "CREATE TRIGGER qualification_participant_private BEFORE DELETE ON application_draft_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected private cleanup failure'"
    );
    let privateFailure = false;
    try {
      for (let attempt = 0; attempt < 30; attempt++) {
        const response = await post();
        await capture();
        if (response.status === 503) {
          privateFailure = true;
          break;
        }
        assert.equal(response.status, 202);
        assert.equal(await completion.state(input), 'pending');
      }
      assert.ok(
        privateFailure,
        'Compiled participant must reach injected private cleanup failure'
      );
      assert.ok(
        (
          await source.query(
            'SELECT * FROM application_draft_commands WHERE ownerIdentityId=?',
            [owner.identityId]
          )
        ).length
      );
    } finally {
      await source.query('DROP TRIGGER qualification_participant_private');
    }
    await restart();
    const counts = async () => {
      const result = [];
      for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS)
        result.push(
          Number(
            (
              await source.query(
                `SELECT COUNT(*) n FROM ${table} WHERE ${column}=?`,
                [owner.identityId]
              )
            )[0].n
          )
        );
      return result;
    };
    let waitingForMedia = false;
    for (let attempt = 0; attempt < 140; attempt++) {
      const before = await counts();
      assert.equal((await post()).status, 202);
      await capture();
      const after = await counts();
      const unfinished = await source.query(
        'SELECT imageId FROM application_image_cleanup WHERE completedAt IS NULL UNION ALL SELECT imageId FROM article_cover_cleanup WHERE completedAt IS NULL'
      );
      if (
        unfinished.length &&
        JSON.stringify(before) === JSON.stringify(after)
      ) {
        assert.equal((await post()).status, 202);
        assert.equal(await completion.state(input), 'pending');
        waitingForMedia = true;
        break;
      }
    }
    assert.ok(
      waitingForMedia,
      'Private metadata must await durable object cleanup'
    );
    await source.query(
      "CREATE TRIGGER qualification_participant_completion BEFORE UPDATE ON identity_erasure_requests FOR EACH ROW BEGIN IF NEW.completedAt IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected final completion failure'; END IF; END"
    );
    await restartWith({
      EDITORIAL_MEDIA_CLEANUP_ENABLED: 'true',
      MONGO_PORT: '1',
    });
    let mongoFailure = false;
    try {
      for (let attempt = 0; attempt < 220; attempt++) {
        const response = await post();
        await capture();
        const remaining = await counts();
        const targetIndex = EDITORIAL_ERASURE_IDENTITY_COLUMNS.findIndex(
          ([t]) => t === 'editorial_erasure_resources'
        );
        if (response.status === 503) {
          assert.ok(remaining[targetIndex] > 0);
          assert.equal(
            remaining
              .filter((_, i) => i !== targetIndex)
              .reduce((a, b) => a + b, 0),
            0
          );
          mongoFailure = true;
          break;
        }
        assert.equal(response.status, 202);
        if (attempt % 5 === 0) await delay(100);
      }
      assert.ok(
        mongoFailure,
        'Mongo outage must retain projection targets after SQL/media phases drain'
      );
      assert.equal(await completion.state(input), 'pending');
      await restartWith({ MONGO_PORT: environment.MONGO_PORT });
      let finalFailure = false;
      for (let attempt = 0; attempt < ownedResources.length + 20; attempt++) {
        const responses = await Promise.all([post(), post()]);
        assert.ok(responses.every((r) => r.status === 202 || r.status === 503));
        if (responses.some((r) => r.status === 503)) {
          assert.ok((await counts()).every((n) => n === 0));
          finalFailure = true;
          break;
        }
      }
      assert.ok(
        finalFailure,
        'All cleanup phases must finish before durable completion is attempted'
      );
      assert.equal(await completion.state(input), 'pending');
    } finally {
      await source.query('DROP TRIGGER qualification_participant_completion');
    }
    await assert.rejects(
      new MysqlEditorialErasureCompletion(source, () => NaN).complete(input),
      /completion time/
    );
    await restart();
    const completed = await Promise.all([post(), post()]);
    for (const response of completed) {
      assert.equal(response.status, 200);
      assert.deepEqual(response.value, {
        ...input,
        participant: 'editorial',
        state: 'completed',
      });
    }
    assert.equal(await completion.state(input), 'completed');
    assert.ok((await counts()).every((n) => n === 0));
    pass(
      'compiled participant sequences canonical, private/media, audit and projection cleanup; private SQL failure, stopped cleanup workers, Mongo outage and final-receipt failure all stay pending; restart and concurrent retries converge to exact durable completion'
    );

    for (const projection of oldProjections) {
      const expected = projectEditorialSnapshot(
        await reader.read(projection.kind, projection.resourceId)
      );
      assert.equal(await projections.publish(projection), 'superseded');
      assert.deepEqual(
        await projections.find(projection.kind, projection.resourceId),
        expected
      );
    }
    for (const { table, column, pk, row } of peers) {
      const [after] = await source.query(
        `SELECT * FROM ${table} WHERE ${pk.map((c) => `${c}=?`).join(' AND ')}`,
        pk.map((c) => row[c])
      );
      // Decisions on this author's own drafts disappear; surviving peer decisions retain their exact meaning.
      if (!after) continue;
      const stamp =
        column === 'actorIdentityId' ? 'actorErasedAt' : 'reviewerErasedAt';
      assert.equal(after[column], null);
      assert.ok(Number(after[stamp]) > 0);
      assert.deepEqual(
        { ...after, [column]: row[column], [stamp]: row[stamp] },
        row
      );
    }
    const missing = EDITORIAL_ERASURE_IDENTITY_COLUMNS.filter(
      ([t, c]) => !samples.has(`${t}.${c}`)
    );
    assert.deepEqual(
      missing,
      [],
      'Every residual field requires a real pre-cleanup sample'
    );
    for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS) {
      const row = samples.get(`${table}.${column}`),
        keys = Object.keys(row);
      const rollback = new Error('Rollback injected residue');
      await assert.rejects(
        source.transaction('READ COMMITTED', async (manager) => {
          await manager.query(
            'UPDATE identity_erasure_requests SET completedAt=NULL WHERE identityId=?',
            [owner.identityId]
          );
          await manager.query(
            `INSERT INTO ${table} (${keys
              .map((k) => '`' + k + '`')
              .join(',')}) VALUES (${keys
              .map(() => '?')
              .join(',')}) ON DUPLICATE KEY UPDATE ${column}=VALUES(${column})`,
            keys.map((k) => {
              const type = columns.find(
                (c) => c.tableName === table && c.columnName === k
              )?.type;
              return type === 'json' &&
                row[k] !== null &&
                typeof row[k] !== 'string'
                ? JSON.stringify(row[k])
                : row[k];
            })
          );
          const inTransaction = {
            transaction: (_isolation, run) => run(manager),
          };
          assert.equal(
            await new MysqlEditorialErasureCompletion(inTransaction).complete(
              input
            ),
            'pending',
            `${table}.${column} cannot be ignored`
          );
          throw rollback;
        }),
        (error) => error === rollback
      );
    }
    assert.equal(await completion.state(input), 'completed');
    const runner = source.createQueryRunner();
    try {
      for (const Migration of source.options.migrations)
        await new Migration().up(runner);
      await runner.query(
        'ALTER TABLE suite_submissions ALTER INDEX idx_erasure_author INVISIBLE'
      );
      await assert.rejects(
        new EditorialErasureCompletion1791840014000().up(runner),
        /completion index/
      );
      await runner.query(
        'ALTER TABLE suite_submissions ALTER INDEX idx_erasure_author VISIBLE'
      );
      await runner.query('DROP INDEX idx_erasure_author ON suite_submissions');
      await assert.rejects(
        new EditorialErasureCompletion1791840014000().up(runner),
        /completion index/
      );
      await runner.query(
        'CREATE INDEX idx_erasure_author ON suite_submissions (ownerIdentityId)'
      );
      await new EditorialErasureCompletion1791840014000().up(runner);
      await assert.rejects(
        new EditorialErasureCompletion1791840014000().down(runner),
        /data-preserving/
      );
    } finally {
      await runner.release();
    }
    await restartWith({
      EDITORIAL_ERASURE_WORKERS_FENCED: 'false',
      MONGO_PORT: '1',
    });
    assert.equal((await post()).status, 200);
    assert.equal(
      (await post({ ...input, revision: input.revision + 1 })).status,
      409
    );
    await restartWith({
      MONGO_PORT: environment.MONGO_PORT,
      EDITORIAL_ERASURE_WORKERS_FENCED: 'true',
      EDITORIAL_MEDIA_CLEANUP_ENABLED: 'false',
    });
    await context.json(403, 'POST', 'me/articles', {
      title: 'Denied',
      slug: 'denied',
      excerpt: 'Denied',
      byline: 'Erased',
      category: 'Guides',
      tags: [],
      sections: [{ heading: 'Denied', paragraphs: ['Denied'] }],
    });
    pass(
      `all ${EDITORIAL_ERASURE_IDENTITY_COLUMNS.length} residual attribution fields block completion independently under real SQL rollback; leading indexes cover every check, migrations reenter and fail on missing/invisible completion indexes, old projections stay superseded, peer decisions survive and completed replay needs neither Mongo nor activation`
    );
  };
};
