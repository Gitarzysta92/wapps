const assert = require('node:assert/strict');

module.exports = async function qualifyTimeline(options) {
  const { application, editorialSource, bffOrigin, pass } = options;
  const accepted = async (response) => {
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };
  const read = (slug = application.slug, after = null) =>
    fetch(
      bffOrigin() +
        '/api/applications/' +
        slug +
        '/timeline' +
        (after ? '?after=' + encodeURIComponent(after) : ''),
      { signal: AbortSignal.timeout(20000) }
    );
  async function pages(slug = application.slug) {
    const items = [],
      cursors = [];
    let after = null;
    for (let page = 0; page < 30; page++) {
      const response = await read(slug, after);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const value = await accepted(response);
      assert.deepEqual(Object.keys(value).sort(), [
        'after',
        'application',
        'items',
      ]);
      assert.equal(value.application.slug, slug);
      assert.ok(value.items.length <= 10);
      for (const item of value.items) {
        assert.notEqual(item.kind, 'article');
        if (item.kind === 'application')
          assert.equal(item.id, value.application.id);
        else if (item.kind !== 'suite')
          assert.equal(item.target.applicationId, value.application.id);
      }
      items.push(...value.items);
      cursors.push(value.after);
      if (!value.after) {
        assert.equal(
          new Set(items.map((item) => item.kind + ':' + item.id)).size,
          items.length
        );
        return { items, cursors };
      }
      assert.notEqual(value.after, after);
      after = value.after;
    }
    throw new Error('Timeline fixture paging exceeded bounds');
  }
  const initial = await pages();
  assert.deepEqual(
    [...new Set(initial.items.map((item) => item.kind))].sort(),
    ['application', 'discussion', 'release', 'review', 'suite']
  );
  assert.equal(
    initial.items.filter((item) => item.kind === 'discussion').length,
    options.topics.length
  );
  assert.ok(initial.items.some((item) => item.id === options.review.id));
  assert.ok(
    initial.items.every((item) => item.categories.includes('category-export'))
  );
  assert.ok(initial.cursors[0]);
  const second = await accepted(
    await read(application.slug, initial.cursors[0])
  );
  await options.restartBff();
  assert.deepEqual(
    (await accepted(await read(application.slug, initial.cursors[0]))).items,
    second.items
  );
  assert.equal(
    (await read('foreign-canonical', initial.cursors[0])).status,
    400
  );
  assert.equal(
    (await read(application.slug, options.exploreCursor)).status,
    400
  );
  assert.equal(
    (
      await fetch(
        bffOrigin() +
          '/api/explore?after=' +
          encodeURIComponent(initial.cursors[0])
      )
    ).status,
    400
  );
  assert.equal((await read('missing-application')).status, 404);
  for (const query of [
    'applicationId=foreign',
    'tenantId=foreign',
    'limit=1000',
  ])
    assert.equal(
      (
        await fetch(
          bffOrigin() +
            '/api/applications/' +
            application.slug +
            '/timeline?' +
            query
        )
      ).status,
      400
    );
  const foreign = await pages('foreign-canonical');
  assert.deepEqual(
    foreign.items.map((item) => item.kind),
    ['application']
  );

  const suite = initial.items.find((item) => item.kind === 'suite');
  const [privateSuite] = await editorialSource.query(
    'SELECT title,applicationIds FROM private_suites WHERE id=?',
    [suite.id]
  );
  const [published] = await editorialSource.query(
    'SELECT applicationIds FROM suite_publications WHERE suiteId=?',
    [suite.id]
  );
  // Controlled authority mutations isolate membership selection from the already-qualified publication command workflow.
  try {
    await editorialSource.query(
      'UPDATE private_suites SET title=?,applicationIds=? WHERE id=?',
      [
        'Unapproved timeline edit',
        JSON.stringify([foreign.items[0].id]),
        suite.id,
      ]
    );
    await options.projectSuite(suite.id);
    const privateEdit = (await pages()).items.find(
      (item) => item.id === suite.id
    );
    assert.equal(privateEdit.title, 'Approved suite');
    assert.equal(
      (await pages('foreign-canonical')).items.some(
        (item) => item.id === suite.id
      ),
      false
    );
    await editorialSource.query(
      'UPDATE suite_publications SET applicationIds=? WHERE suiteId=?',
      [JSON.stringify([]), suite.id]
    );
    assert.equal(
      (await pages()).items.some((item) => item.id === suite.id),
      false
    );
  } finally {
    const json = (value) =>
      typeof value === 'string' ? value : JSON.stringify(value);
    await editorialSource.query(
      'UPDATE private_suites SET title=?,applicationIds=? WHERE id=?',
      [privateSuite.title, json(privateSuite.applicationIds), suite.id]
    );
    await editorialSource.query(
      'UPDATE suite_publications SET applicationIds=? WHERE suiteId=?',
      [json(published.applicationIds), suite.id]
    );
    await options.projectSuite(suite.id);
  }
  assert.ok((await pages()).items.some((item) => item.id === suite.id));
  pass(
    'Application timeline: five public kinds are selected by canonical application before bounded paging; private suite edits never change approved membership/title; withdrawal removes stale suite membership; missing parents and forged/cross-application/Explore cursors fail; continuation survives BFF restart'
  );
  return { read, pages };
};
