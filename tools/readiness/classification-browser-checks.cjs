const assert = require('node:assert/strict');

module.exports = async function classificationBrowserChecks({
  classified,
  session,
  go,
  text,
  capture,
  click,
  call,
  headers,
  project,
}) {
  const author = await session('draft-alice');
  const independent = await session('draft-alice');
  const reviewer = await session('draft-reviewer');
  const matureReader = await session('draft-bob');
  const guest = await session('');
  const route = '/discover?search=Classification&pageSize=100';
  const cards = (page) =>
    page.$$eval('discover-api-page .item-card', (items) =>
      items.map((item) => item.textContent)
    );
  for (const page of [author, matureReader, guest]) {
    await go(route, page);
    await text('Classification article general', page);
    const results = await cards(page);
    assert.equal(results.length, page === matureReader ? 9 : 3);
    if (page !== matureReader) {
      assert(results.every((value) => !/mature|unclassified/.test(value)));
      await text('2 hidden on this page by saved choices', page);
    }
  }
  await capture('classification-filtered', author);
  await capture('classification-all', matureReader);
  await matureReader.evaluate(() => {
    localStorage.setItem('_i', 'draft-alice');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: '_i',
        newValue: 'draft-alice',
        storageArea: localStorage,
      })
    );
  });
  await matureReader.waitForFunction(
    () => document.querySelectorAll('discover-api-page .item-card').length === 3
  );
  assert(
    (await cards(matureReader)).every(
      (value) => !/mature|unclassified/.test(value)
    )
  );

  const ui = {
    app: {
      edit: (id) => '/apps/register?draftId=' + id,
      publication: (id) => '/my/apps/' + id + '/publication',
      review: (id) => '/editorial/apps/' + id,
      selector: '#application-draft-classification',
      save: 'Save draft',
      submit: 'Submit for review',
      approve: 'Approve publication',
    },
    article: {
      edit: (id) => '/my/articles/' + id,
      publication: (id) => '/my/articles/' + id,
      review: (id) => '/editorial/articles/' + id,
      selector: '#article-classification',
      save: 'Save article draft',
      submit: 'Submit saved article',
      approve: 'Approve submitted article',
    },
    suite: {
      edit: (id) => '/my/suites/' + id,
      publication: (id) => '/my/suites/' + id + '/publication',
      review: (id) => '/editorial/suites/' + id,
      selector: '#suite-classification',
      save: 'Save suite',
      submit: 'Submit saved draft',
      approve: 'Approve submission',
    },
  };
  async function change(page, label, route, method, status) {
    const response = page.waitForResponse(
      (value) =>
        new URL(value.url()).pathname === '/api/' + route &&
        value.request().method() === method
    );
    await click(label, page);
    const result = await response;
    assert.equal(result.status(), status, await result.text());
    return result.json();
  }
  for (const spec of classified) {
    const controls = ui[spec.kind];
    const base = spec.base + '/' + spec.id;
    await go(controls.edit(spec.id), author);
    if (spec.kind === 'suite') await click('Edit suite', author);
    await author.waitForSelector(controls.selector, { visible: true });
    assert.equal(
      await author.$eval(controls.selector, (input) => input.value),
      'general'
    );
    await author.select(controls.selector, 'mature');
    await capture('classification-' + spec.kind + '-author', author);
    await change(author, controls.save, base, 'PUT', 200);
    assert.equal(
      (await call(base, 'GET', undefined, headers('DraftBrowserAlice')))
        .classification,
      'mature'
    );
    await go(controls.edit(spec.id), independent);
    if (spec.kind === 'suite') await click('Edit suite', independent);
    await independent.waitForSelector(controls.selector);
    assert.equal(
      await independent.$eval(controls.selector, (input) => input.value),
      'mature'
    );

    await go(controls.publication(spec.id), author);
    await change(author, controls.submit, base + '/submit', 'POST', 201);
    const draft = await call(
      base,
      'GET',
      undefined,
      headers('DraftBrowserAlice')
    );
    await call(
      base,
      'PUT',
      {
        ...spec.fields,
        classification: 'general',
        expectedRevision: draft.revision,
      },
      headers('DraftBrowserAlice')
    );
    await go(controls.review(spec.id), reviewer);
    await text('Submitted classification: mature', reviewer);
    await capture('classification-' + spec.kind + '-review', reviewer);
    await change(
      reviewer,
      controls.approve,
      spec.review + '/' + spec.id + '/decision',
      'POST',
      201
    );
    await project(spec.kind, spec.id);
    assert.equal(
      (await call(base, 'GET', undefined, headers('DraftBrowserAlice')))
        .classification,
      'general'
    );
    const state = await call(
      base + '/publication',
      'GET',
      undefined,
      headers('DraftBrowserAlice')
    );
    assert.equal(state.latestSubmission.classification, 'mature');
    assert.equal(state.latestSubmission.status, 'approved');
  }
  await go(route, author);
  await text('3 hidden on this page by saved choices', author);
  assert.deepEqual(await cards(author), []);
  await go(route, guest);
  await text('3 hidden on this page by saved choices', guest);
  assert.deepEqual(await cards(guest), []);
  const enabled = await session('draft-bob');
  await go(route, enabled);
  await text('Classification article general', enabled);
  assert.equal((await cards(enabled)).length, 9);
  return [
    'Authors save classifications across independent sessions for applications, articles and suites',
    'Staff review and approve frozen classifications despite later private changes',
    'Discover applies explicit member preference fixtures and guest defaults, including account switches and newly approved classifications',
    'Author/reviewer controls and filtered/unfiltered discovery inspected in six theme/viewport combinations each',
  ];
};
