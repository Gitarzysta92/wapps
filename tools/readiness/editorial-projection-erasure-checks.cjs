const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = '../../apps/services/editorial/src/app/';
const { EraseEditorialProjections } = require(base +
  'account-erasure/erase-editorial-projections');
const { MysqlEditorialProjectionErasure } = require(base +
  'account-erasure/mysql-editorial-projection-erasure');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');

module.exports = async function editorialProjectionErasureChecks({
  source,
  reader,
  projections,
  collection,
  input,
  resources,
  before,
  app,
  article,
  articleFields,
  newOwner,
  editorial,
  participant,
  restart,
  request,
  qualifyBrowser,
  pass,
}) {
  const repository = new MysqlEditorialProjectionErasure(source);
  const worker = () =>
    new EraseEditorialProjections(
      new MysqlEditorialProjectionErasure(source),
      reader,
      projections
    );
  const count = async () =>
    Number(
      (
        await source.query(
          'SELECT COUNT(*) n FROM editorial_erasure_resources WHERE identityId=?',
          [input.identityId]
        )
      )[0].n
    );
  const save = (projection) =>
    collection.replaceOne({ _id: projection._id }, projection, {
      upsert: true,
      writeConcern: { w: 'majority', j: true },
    });
  const current = async (kind, id) =>
    projectEditorialSnapshot(await reader.read(kind, id));
  const target = await repository.next(input);
  assert.equal(target.kind, 'app');
  assert.equal(target.resourceId, app.id);
  const originalCount = await count();
  assert.equal(originalCount, resources.length);
  await assert.rejects(
    worker().advance({ identityId: 'MissingRequest', revision: 1 }),
    /Missing Editorial erasure request/
  );
  await assert.rejects(
    worker().advance({ ...input, revision: input.revision + 1 }),
    /exact erasure request/
  );
  await source.query(
    'UPDATE identity_erasure_requests SET completedAt=requestedAt WHERE identityId=?',
    [input.identityId]
  );
  try {
    await assert.rejects(worker().advance(input), /pending erasure request/);
    await assert.rejects(
      repository.complete(input, target, await current('app', app.id)),
      /pending erasure request/
    );
  } finally {
    await source.query(
      'UPDATE identity_erasure_requests SET completedAt=NULL WHERE identityId=?',
      [input.identityId]
    );
  }
  await source.query(
    'UPDATE editorial_resource_states SET ownerIdentityId=? WHERE resourceKind=? AND resourceId=?',
    [input.identityId, 'app', app.id]
  );
  try {
    await assert.rejects(
      worker().advance(input),
      /Canonical Editorial anonymity must finish/
    );
    await assert.rejects(
      repository.complete(input, target, await current('app', app.id)),
      /anonymous or transferred authority/
    );
  } finally {
    await source.query(
      'UPDATE editorial_resource_states SET ownerIdentityId=? WHERE resourceKind=? AND resourceId=?',
      [newOwner.identityId, 'app', app.id]
    );
  }
  for (const [column, value, expected] of [
    ['erasureRevision', input.revision + 1, /request changed/],
    [
      'projectionRevision',
      target.minimumRevision + 100,
      /anonymous or transferred authority/,
    ],
  ]) {
    await source.query(
      `UPDATE editorial_erasure_resources SET ${column}=? WHERE identityId=? AND resourceKind='app' AND resourceId=?`,
      [value, input.identityId, app.id]
    );
    try {
      await assert.rejects(worker().advance(input), expected);
    } finally {
      await source.query(
        `UPDATE editorial_erasure_resources SET ${column}=? WHERE identityId=? AND resourceKind='app' AND resourceId=?`,
        [
          column === 'erasureRevision'
            ? input.revision
            : target.minimumRevision,
          input.identityId,
          app.id,
        ]
      );
    }
  }
  for (const invalid of [
    { tenantId: 'foreign' },
    { resourceId: randomUUID() },
    { revision: target.minimumRevision - 1 },
    { kind: 'category', content: null, deletedAt: 1 },
  ]) {
    const snapshot = await reader.read('app', app.id);
    await assert.rejects(
      async () =>
        repository.complete(
          input,
          target,
          projectEditorialSnapshot({ ...snapshot, ...invalid })
        ),
      /differs from its target/
    );
  }
  const canonical = await current('app', app.id);
  await assert.rejects(
    repository.complete(
      input,
      target,
      projectEditorialSnapshot({
        ...(await reader.read('app', app.id)),
        deletedAt: Date.now(),
        content: null,
      })
    ),
    /canonical lifecycle/
  );
  const store = (overrides) => ({
    publish: (p) => projections.publish(p),
    find: (k, id) => projections.find(k, id),
    ...overrides,
  });
  for (const overrides of [
    {
      publish: async () => {
        throw new Error('Injected Mongo write outage');
      },
    },
    {
      find: async () => {
        throw new Error('Injected Mongo read outage');
      },
    },
  ]) {
    await assert.rejects(
      new EraseEditorialProjections(
        repository,
        reader,
        store(overrides)
      ).advance(input),
      /Injected Mongo/
    );
    assert.equal(await count(), originalCount);
  }
  for (const found of [
    null,
    projectEditorialSnapshot(before.get(app.id).snapshot),
  ]) {
    assert.equal(
      await new EraseEditorialProjections(
        repository,
        reader,
        store({ find: async () => found })
      ).advance(input),
      'pending'
    );
    assert.equal(await count(), originalCount);
  }
  pass(
    'projection cleanup requires the exact pending request, completed canonical anonymity, matching targets and lifecycle; Mongo write/read failure or missing/lagging confirmation cannot remove targets'
  );

  for (const invalid of [
    { ...canonical, fingerprint: 'corrupt' },
    { ...canonical, ownerIdentityId: input.identityId },
    projectEditorialSnapshot({
      ...(await reader.read('app', app.id)),
      tenantId: 'foreign',
    }),
    projectEditorialSnapshot({
      ...(await reader.read('app', app.id)),
      content: { ...canonical.content, name: 'Same-revision conflict' },
    }),
  ]) {
    await save(invalid);
    try {
      await assert.rejects(
        worker().advance(input),
        /snapshot fields|Conflicting/
      );
    } finally {
      await save(canonical);
    }
    assert.equal(await count(), originalCount);
  }
  const ahead = projectEditorialSnapshot({
    ...(await reader.read('app', app.id)),
    revision: canonical.revision + 100,
  });
  await save(ahead);
  try {
    assert.equal(await worker().advance(input), 'pending');
    assert.equal(await count(), originalCount);
    assert.deepEqual(await projections.find('app', app.id), ahead);
  } finally {
    await save(canonical);
  }
  pass(
    'corrupt, unexpected attributed, cross-tenant and conflicting stored documents fail closed; ahead-of-authority revisions remain pending without destructive repair'
  );

  const edit = async (name) => {
    const projection = await current('app', app.id);
    await editorial.update(
      'app',
      app.id,
      { name, expectedRevision: projection.revision },
      newOwner,
      randomUUID()
    );
  };
  let once = false;
  const advancedStore = store({
    publish: async (projection) => {
      const outcome = await projections.publish(projection);
      if (!once) {
        once = true;
        await edit('New owner concurrent publication');
        await projections.publish(await current('app', app.id));
      }
      return outcome;
    },
  });
  assert.equal(
    await new EraseEditorialProjections(
      repository,
      reader,
      advancedStore
    ).advance(input),
    'pending'
  );
  assert.equal(await count(), originalCount);
  const confirmedStore = store({
    find: async (kind, id) => {
      const found = await projections.find(kind, id);
      await edit('New owner edit after Mongo confirmation');
      return found;
    },
  });
  assert.equal(
    await new EraseEditorialProjections(
      repository,
      reader,
      confirmedStore
    ).advance(input),
    'pending'
  );
  assert.equal(await count(), originalCount);
  assert.equal(await repository.complete(input, target, canonical), false);
  pass(
    'concurrent newer Mongo publication and successor edits after confirmation preserve SQL targets; stale confirmations cannot acknowledge a newer canonical revision'
  );

  await collection.deleteOne(
    { _id: canonical._id },
    { writeConcern: { w: 'majority', j: true } }
  );
  await source.query(
    "CREATE TRIGGER qualification_projection_failure BEFORE DELETE ON editorial_erasure_resources FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected projection target failure'"
  );
  try {
    await assert.rejects(
      worker().advance(input),
      /Injected projection target failure/
    );
  } finally {
    await source.query('DROP TRIGGER qualification_projection_failure');
  }
  assert.equal(await count(), originalCount);
  const successor = await current('app', app.id);
  assert.deepEqual(await projections.find('app', app.id), successor);
  await restart();
  assert.equal(await worker().advance(input), 'pending');
  assert.equal(await count(), originalCount - 1);
  assert.equal(await repository.complete(input, target, successor), true);
  assert.deepEqual(await projections.find('app', app.id), successor);
  const [owner] = await source.query(
    'SELECT ownerIdentityId FROM editorial_resource_states WHERE resourceKind=? AND resourceId=?',
    ['app', app.id]
  );
  assert.equal(owner.ownerIdentityId, newOwner.identityId);
  pass(
    'a missing projection is rebuilt; SQL deletion failure after durable Mongo success retains the target; a new worker after API restart safely retries and preserves successor authority'
  );

  const oldArticle = projectEditorialSnapshot(before.get(article.id).snapshot);
  await save(oldArticle);
  const lag = await request(
    503,
    'GET',
    `catalog/articles/${articleFields.slug}`,
    undefined,
    null
  );
  assert.ok(!JSON.stringify(lag).includes(articleFields.byline));
  const materialize = async () => {
    assert.equal((await repository.next(input)).resourceId, article.id);
    assert.equal(await worker().advance(input), 'pending');
    assert.equal(await count(), originalCount - 2);
  };
  if (qualifyBrowser)
    await qualifyBrowser({ fields: articleFields, materialize });
  else await materialize();
  const publicArticle = await request(
    200,
    'GET',
    `catalog/articles/${articleFields.slug}`,
    undefined,
    null
  );
  assert.equal(publicArticle.byline, 'Deleted account');
  assert.deepEqual(
    await projections.find('article', article.id),
    await current('article', article.id)
  );
  assert.equal(await projections.publish(oldArticle), 'superseded');
  pass(
    'an actual stale article projection is replaced at its stable ID; compiled public HTTP and optional portal show truthful lag followed by retained anonymous text; delayed old publication cannot restore its byline'
  );

  const initial = await count();
  const sameTarget = await repository.next(input);
  let readers = 0,
    resume;
  const bothReading = new Promise((resolve) => {
    resume = resolve;
  });
  const gatedReader = {
    read: async (kind, id) => {
      assert.equal(kind, sameTarget.kind);
      assert.equal(id, sameTarget.resourceId);
      const snapshot = await reader.read(kind, id);
      if (++readers === 2) resume();
      await bothReading;
      return snapshot;
    },
  };
  assert.deepEqual(
    await Promise.all([
      new EraseEditorialProjections(
        repository,
        gatedReader,
        projections
      ).advance(input),
      new EraseEditorialProjections(
        new MysqlEditorialProjectionErasure(source),
        gatedReader,
        projections
      ).advance(input),
    ]),
    ['pending', 'pending']
  );
  assert.equal(await count(), initial - 1);
  let calls = 0;
  while ((await worker().advance(input)) !== 'drained')
    assert.ok(++calls <= resources.length);
  assert.equal(await count(), 0);
  for (const [kind, id] of resources) {
    const expected = await current(kind, id);
    assert.deepEqual(await projections.find(kind, id), expected);
    assert.equal(
      await projections.publish(
        projectEditorialSnapshot(before.get(id).snapshot)
      ),
      'superseded'
    );
    assert.deepEqual(await projections.find(kind, id), expected);
  }
  assert.equal((await participant.request(input)).state, 'pending');
  const runner = source.createQueryRunner();
  try {
    for (const Migration of source.options.migrations)
      await new Migration().up(runner);
  } finally {
    await runner.release();
  }
  await restart();
  assert.equal(await worker().advance(input), 'drained');
  assert.equal(
    (
      await request(
        200,
        'GET',
        `catalog/articles/${articleFields.slug}`,
        undefined,
        null
      )
    ).byline,
    'Deleted account'
  );
  pass(
    'duplicate workers converge on one exact target; bounded cleanup drains all six kinds across tenants, preserves tombstones, accepts migration reentry and survives restart; the incomplete overall participant remains pending'
  );
};
