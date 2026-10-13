const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

async function memberReviewsChecks(options) {
  const {
    application,
    discussion,
    accepted,
    discussionSource: source,
    pass,
  } = options;
  const base = `application-reviews/${application.id}`;
  const author = { identityId: 'ReviewAuthor', tenantId: 'default', roles: [] };
  const bob = { ...author, identityId: 'ReviewBob' };
  const charlie = { ...author, identityId: 'ReviewCharlie' };
  const admin = { ...author, identityId: 'ReviewModerator', roles: ['admin'] };
  const content = {
    displayName: 'Public reviewer',
    rating: 4,
    text: 'Original durable member review.',
  };
  const get = (suffix = '', actor = null) =>
    discussion('GET', base + suffix, undefined, actor);
  const publish = (body, key = randomUUID()) =>
    discussion('PUT', base + '/mine', body, author, key);
  assert.deepEqual(accepted(await get('/summary')), {
    total: 0,
    average: null,
    distribution: [0, 0, 0, 0, 0],
  });
  const firstBody = { expectedRevision: 0, content },
    firstKey = randomUUID();
  const copies = await Promise.all(
    Array.from({ length: 4 }, () => publish(firstBody, firstKey))
  );
  const receipt = accepted(copies[0]);
  copies.forEach((copy) => assert.deepEqual(accepted(copy), receipt));
  const id = receipt.id;
  assert.equal(receipt.revision, 1);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS n FROM review_versions WHERE reviewId=?',
          [id]
        )
      )[0].n
    ),
    1
  );
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS n FROM review_events WHERE reviewId=?',
          [id]
        )
      )[0].n
    ),
    1
  );
  let current = accepted(await get('/' + id));
  assert.equal(current.mine, false);
  assert.equal('ownerId' in current, false);
  assert.equal(accepted(await get('', author)).mine.id, id);
  assert.equal((await publish(firstBody)).status, 409);
  assert.equal(
    (
      await publish(
        { ...firstBody, content: { ...content, rating: 5 } },
        firstKey
      )
    ).status,
    409
  );
  assert.equal(
    (await discussion('PUT', base + '/mine', firstBody, null)).status,
    401
  );
  assert.equal(
    (
      await discussion(
        'PUT',
        base + '/mine',
        { ...firstBody, ownerId: 'forged' },
        bob
      )
    ).status,
    400
  );
  assert.equal(
    (
      await discussion(
        'PUT',
        base + '/mine',
        { ...firstBody, content: { ...content, rating: 6 } },
        bob
      )
    ).status,
    400
  );
  assert.equal((await get('', { ...author, tenantId: 'other' })).status, 404);
  assert.equal(
    (await get('/summary', { ...admin, tenantId: 'other' })).status,
    404
  );
  assert.equal(
    (await discussion('DELETE', `${base}/${id}`, { expectedRevision: 1 }, bob))
      .status,
    403
  );
  assert.equal(
    (
      await discussion(
        'PUT',
        `${base}/${id}/helpful`,
        { expectedRevision: 1, helpful: true },
        author
      )
    ).status,
    403
  );
  pass(
    'Member reviews: canonical author slot, strict rating/body validation, concurrent exact replay, private identity omission, tenant/author enforcement and truthful empty summary'
  );

  const help = (user) =>
    discussion(
      'PUT',
      `${base}/${id}/helpful`,
      { expectedRevision: 1, helpful: true },
      user
    );
  const race = await Promise.all([help(bob), help(charlie)]);
  assert.deepEqual(race.map((value) => value.status).sort(), [200, 409]);
  current = accepted(await get('/' + id));
  assert.equal(current.helpfulCount, 1);
  const winner = race[0].status === 200 ? bob : charlie;
  const loser = race[0].status === 200 ? charlie : bob;
  const helpKey = randomUUID();
  const helpBody = { expectedRevision: current.revision, helpful: true };
  const helpReceipt = accepted(
    await discussion('PUT', `${base}/${id}/helpful`, helpBody, loser, helpKey)
  );
  assert.deepEqual(
    accepted(
      await discussion('PUT', `${base}/${id}/helpful`, helpBody, loser, helpKey)
    ),
    helpReceipt
  );
  current = accepted(await get('/' + id, winner));
  assert.equal(current.helpfulCount, 2);
  assert.equal(current.helpful, true);
  accepted(
    await discussion(
      'PUT',
      `${base}/${id}/helpful`,
      { expectedRevision: current.revision, helpful: false },
      winner
    )
  );
  current = accepted(await get('/' + id));
  assert.equal(current.helpfulCount, 1);
  const reportReceipt = accepted(
    await discussion(
      'POST',
      `${base}/${id}/reports`,
      {
        expectedRevision: current.revision,
        reason: 'Please review this text.',
      },
      bob
    ),
    201
  );
  assert.equal(
    (
      await discussion(
        'POST',
        `${base}/${id}/reports`,
        { expectedRevision: reportReceipt.revision, reason: 'Repeat' },
        bob
      )
    ).status,
    409
  );
  assert.equal((await get('/' + id + '/reports', bob)).status, 403);
  assert.equal((await get('/moderation', author)).status, 403);
  const edited = {
    ...content,
    text: 'Edited while a report is open.',
    rating: 5,
  };
  current = accepted(
    await publish({ expectedRevision: reportReceipt.revision, content: edited })
  );
  const reports = accepted(await get('/' + id + '/reports', admin));
  assert.equal(reports.items[0].content.text, content.text);
  assert.equal('actorId' in reports.items[0], false);
  assert.equal(accepted(await get('/summary')).average, 5);
  assert.equal(accepted(await get('/' + id, admin)).openReports, 1);
  pass(
    'Member reviews: real concurrent helpful conflicts, switching/removal, one report per reporter/content version and immutable reported-text evidence'
  );

  let version = current.revision;
  const moderate = async (hidden) => {
    const result = accepted(
      await discussion(
        'PUT',
        `${base}/${id}/moderation`,
        {
          expectedRevision: version,
          hidden,
          reason: hidden ? 'Needs correction.' : 'Concern resolved.',
        },
        admin
      )
    );
    version = result.revision;
  };
  await moderate(true);
  assert.equal(accepted(await get('/summary')).total, 0);
  assert.equal((await get('/' + id)).status, 404);
  assert.equal((await get('/' + id, bob)).status, 404);
  assert.equal(accepted(await get('/' + id, author)).hidden, true);
  assert.equal(
    accepted(await get('/' + id + '/reports', admin)).items[0].resolution,
    'hidden'
  );
  version = accepted(
    await publish({
      expectedRevision: version,
      content: { ...edited, text: 'Correction for staff.' },
    })
  ).revision;
  assert.equal(accepted(await get('/' + id, author)).hidden, true);
  version = accepted(
    await discussion(
      'DELETE',
      `${base}/${id}`,
      { expectedRevision: version },
      author
    )
  ).revision;
  await moderate(false);
  assert.equal((await get('/' + id)).status, 404);
  assert.equal(accepted(await get('/summary')).total, 0);
  version = accepted(
    await publish({ expectedRevision: version, content: edited })
  ).revision;
  assert.equal(accepted(await get('/summary')).total, 1);
  assert.deepEqual(accepted(await publish(firstBody, firstKey)), receipt);
  assert.equal(accepted(await get('/' + id)).content.text, edited.text);
  pass(
    'Member reviews: staff hide excludes detail/aggregates immediately, author edits cannot bypass it, staff restore preserves withdrawal, explicit republish and historical receipt replay converge'
  );

  const failingBody = {
      expectedRevision: version,
      content: { ...edited, text: 'Atomic rollback then recovered.' },
    },
    failingKey = randomUUID();
  await source.query(
    "CREATE TRIGGER review_qualification_failure BEFORE INSERT ON review_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='qualification rollback'"
  );
  try {
    assert.equal((await publish(failingBody, failingKey)).status, 503);
  } finally {
    await source.query('DROP TRIGGER review_qualification_failure');
  }
  assert.equal(accepted(await get('/' + id)).revision, version);
  const versions = await source.query(
    'SELECT revision FROM review_versions WHERE reviewId=? AND revision=?',
    [id, version + 1]
  );
  assert.equal(versions.length, 0);
  const recovered = accepted(await publish(failingBody, failingKey));
  await options.stopWorker();
  await options.restart();
  assert.deepEqual(accepted(await publish(failingBody, failingKey)), recovered);
  assert.equal(
    accepted(await get('/' + id)).content.text,
    failingBody.content.text
  );
  assert.equal(accepted(await get('/summary')).average, 5);
  options.startWorker();
  const appAuthority = (
    await source.query(
      'SELECT * FROM review_applications WHERE tenantId=? AND applicationId=?',
      ['default', application.id]
    )
  )[0];
  await source.query(
    'DELETE FROM review_applications WHERE tenantId=? AND applicationId=?',
    ['default', application.id]
  );
  try {
    assert.equal((await get('/summary')).status, 503);
    assert.equal(
      (await publish({ expectedRevision: recovered.revision, content })).status,
      503
    );
  } finally {
    await source.query(
      'INSERT INTO review_applications (tenantId, applicationId, revision) VALUES (?, ?, ?)',
      ['default', application.id, appAuthority.revision]
    );
  }
  pass(
    'Member reviews: injected journal failure rolls content/state/receipt back atomically; exact recovery and API restart retain content/counts without a materializer'
  );

  for (let index = 0; index < 12; index++)
    accepted(
      await discussion(
        'PUT',
        base + '/mine',
        {
          expectedRevision: 0,
          content: {
            ...content,
            displayName: `Page member ${index}`,
            rating: (index % 5) + 1,
          },
        },
        { ...bob, identityId: `ReviewPaging${index}` }
      )
    );
  const first = accepted(await get());
  const second = accepted(
    await get('?cursor=' + encodeURIComponent(first.next))
  );
  assert.equal(first.items.length, 10);
  assert.equal(second.items.length, 3);
  assert.equal(second.next, null);
  assert.equal(
    new Set([...first.items, ...second.items].map((item) => item.id)).size,
    13
  );
  assert.equal(first.summary.total, 13);
  assert.deepEqual(first.summary, accepted(await get('/summary')));
  await options.withdraw();
  assert.equal((await get()).status, 404);
  assert.equal((await get('/summary')).status, 404);
  assert.equal(
    (await publish({ expectedRevision: recovered.revision, content })).status,
    404
  );
  await options.republish();
  const { MemberReviews1791676827000 } = require(path.join(
    options.root,
    'sdk/features/discussion/applications/management/service/src/app/reviews/infrastructure/member-reviews.migration'
  ));
  const migration = new MemberReviews1791676827000(),
    runner = source.createQueryRunner();
  try {
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving/);
    await source.query(
      'RENAME TABLE review_events TO review_events_qualification'
    );
    try {
      await assert.rejects(
        migration.up(runner),
        /Completed review table is missing/
      );
    } finally {
      await source.query(
        'RENAME TABLE review_events_qualification TO review_events'
      );
    }
    await migration.up(runner);
  } finally {
    await runner.release();
  }
  pass(
    'Member reviews: bounded keyset pages and summary agreement, parent withdrawal/republish, repeatable schema validation and refusal to recreate lost completed authority'
  );
  await require('./member-reviews-browser.cjs').memberReviewsBrowser(options);
}

module.exports = { memberReviewsChecks };
