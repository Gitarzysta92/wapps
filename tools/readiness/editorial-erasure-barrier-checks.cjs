const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  beginIdentityErasure,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');

module.exports = async function editorialErasureBarriers({
  source,
  origin,
  secret,
  restart,
  pass,
}) {
  const owner = 'ErasureAuthor';
  const staff = 'ErasureReviewer';
  async function request(
    status,
    route,
    body,
    uid = owner,
    roles = [],
    key = randomUUID()
  ) {
    const response = await fetch(origin() + '/api/' + route, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': uid,
        'x-user-claims': JSON.stringify({ tenantId: 'default', roles }),
        'x-ingress-auth': secret,
        'idempotency-key': key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const value = await response.json();
    assert.equal(response.status, status, route + ': ' + JSON.stringify(value));
    if (status === 403)
      assert.match(value.message, /Account erasure prevents this write/);
    return value;
  }
  const app = await request(
    201,
    'apps',
    {
      name: 'Retained application',
      slug: 'barrier-application',
      website: 'https://app.example.test',
    },
    'ErasurePublisher',
    ['editorial:publisher']
  );
  const families = [
    {
      route: 'application-drafts',
      review: 'application-reviews',
      fields: {
        name: 'Application draft',
        slug: 'barrier-draft',
        website: 'https://draft.example.test',
        description: 'An unpublished application draft.',
      },
    },
    {
      route: 'suites',
      review: 'suite-reviews',
      fields: {
        title: 'Pending collection',
        description: 'An unpublished collection.',
        applicationIds: [app.id],
      },
    },
    {
      route: 'articles',
      review: 'article-reviews',
      fields: {
        title: 'An unpublished article',
        slug: 'barrier-article',
        excerpt: 'An unpublished article summary.',
        byline: 'Private author',
        category: 'Guides',
        tags: [],
        sections: [
          {
            heading: 'Introduction',
            paragraphs: ['An unpublished article body.'],
          },
        ],
      },
    },
  ];
  for (const family of families) {
    family.key = randomUUID();
    family.receipt = await request(
      201,
      'me/' + family.route,
      family.fields,
      owner,
      [],
      family.key
    );
    family.submit = {
      expectedRevision: 1,
      ...(family.route === 'articles'
        ? { expectedPublicationRevision: null }
        : {}),
    };
    family.submitKey = randomUUID();
    await request(
      201,
      `me/${family.route}/${family.receipt.id}/submit`,
      family.submit,
      owner,
      [],
      family.submitKey
    );
  }
  const claimFields = {
    applicationId: app.id,
    evidenceUrl: 'https://app.example.test/team',
    notes: 'I operate the official application website.',
  };
  const claim = await request(201, 'me/ownership-claims', claimFields);
  async function counts() {
    const result = {};
    for (const table of [
      'editorial_outbox',
      'application_drafts',
      'private_suites',
      'article_drafts',
      'application_publication_commands',
      'suite_publication_commands',
      'article_commands',
      'application_ownership_decisions',
    ])
      result[table] = Number(
        (await source.query(`SELECT COUNT(*) AS total FROM ${table}`))[0].total
      );
    return result;
  }
  const before = await counts();
  await source.transaction('READ COMMITTED', (manager) =>
    beginIdentityErasure(manager, owner, 5, Date.now())
  );
  async function assertBlocked() {
    for (const family of families) {
      await request(
        403,
        'me/' + family.route,
        family.fields,
        owner,
        [],
        family.key
      );
      await request(
        403,
        `me/${family.route}/${family.receipt.id}/submit`,
        family.submit,
        owner,
        [],
        family.submitKey
      );
      await request(
        403,
        `editorial/${family.review}/${family.receipt.id}/decision`,
        {
          decision: 'approve',
          expectedRevision: 2,
          submittedRevision: 1,
          ...(family.route === 'articles'
            ? { expectedPublicationRevision: null, reason: '' }
            : {}),
        },
        staff,
        ['editorial:reviewer']
      );
    }
    await request(403, 'me/ownership-claims', claimFields);
    await request(
      403,
      `editorial/ownership-reviews/${claim.id}/decision`,
      {
        decision: 'reject',
        expectedRevision: 1,
        reason: 'Account erasure began.',
      },
      staff,
      ['editorial:ownership-reviewer']
    );
    assert.deepEqual(await counts(), before);
  }
  await assertBlocked();
  await restart();
  await assertBlocked();
  // An erased reviewer also cannot change a still-active author's submission.
  const active = await request(
    201,
    'me/application-drafts',
    { ...families[0].fields, slug: 'active-author' },
    'ActiveAuthor'
  );
  await request(
    201,
    `me/application-drafts/${active.id}/submit`,
    { expectedRevision: 1 },
    'ActiveAuthor'
  );
  await source.transaction('READ COMMITTED', (manager) =>
    beginIdentityErasure(manager, staff, 3, Date.now())
  );
  await request(
    403,
    `editorial/application-reviews/${active.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: 2,
      submittedRevision: 1,
    },
    staff,
    ['editorial:reviewer']
  );
  pass(
    'compiled Editorial/OPA denies erased actor and owner writes, receipt replay, publication review and ownership decisions across API restart; canonical rows and outbox remain unchanged'
  );
};
