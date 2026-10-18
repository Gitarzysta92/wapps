const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

async function profileParityContent({
  call,
  at,
  owner,
  operator,
  services,
  ingressSecret,
  classification = 'general',
  checkLag = true,
  startWorker = true,
  saveFavorite = true,
}) {
  // Provision reviewed source content with canonical test identities through owning APIs.
  // Profile reads and Discussion commands below use the real authenticated portal gateway.
  const editorial = (route, options = {}) =>
    call('/api/' + route, {
      at: services.endpoints.EDITORIAL_URL,
      headers: {
        'X-Ingress-Auth': ingressSecret,
        'X-User-Id': owner.uid,
        'X-User-Claims': JSON.stringify({ roles: [], tenantId: 'default' }),
        'Idempotency-Key': randomUUID(),
      },
      ...options,
    });
  const staff = {
    'X-Ingress-Auth': ingressSecret,
    'X-User-Id': operator.uid,
    'X-User-Claims': JSON.stringify({
      roles: ['editorial:reviewer'],
      tenantId: 'default',
    }),
    'Idempotency-Key': randomUUID(),
  };
  async function publish(workspace, reviews, record) {
    const current = await editorial(`me/${workspace}/${record.id}/publication`);
    await editorial(`me/${workspace}/${record.id}/submit`, {
      status: 201,
      body: {
        expectedRevision: current.revision,
        ...(workspace === 'articles'
          ? { expectedPublicationRevision: current.publicationRevision }
          : {}),
      },
    });
    const review = await editorial(`editorial/${reviews}/${record.id}`, {
      headers: staff,
    });
    await editorial(`editorial/${reviews}/${record.id}/decision`, {
      headers: { ...staff, 'Idempotency-Key': randomUUID() },
      status: 201,
      body: {
        decision: 'approve',
        expectedRevision: review.revision,
        submittedRevision: review.latestSubmission.submittedRevision,
        reason: '',
        ...(workspace === 'articles'
          ? { expectedPublicationRevision: review.publicationRevision }
          : {}),
      },
    });
  }
  const application = await editorial('me/application-drafts', {
    status: 201,
    body: {
      ...(classification === null ? {} : { classification }),
      name: 'Profile source application',
      slug: 'profile-app-' + randomUUID(),
      website: 'https://profile.example.test/',
      description: 'Canonical source for shared profile content.',
    },
  });
  await publish('application-drafts', 'application-reviews', application);
  const suite = await editorial('me/suites', {
    status: 201,
    body: {
      title: 'Shared profile collection',
      ...(classification === null ? {} : { classification }),
      description: 'A reviewed collection.',
      applicationIds: [application.id],
    },
  });
  const article = await editorial('me/articles', {
    status: 201,
    body: {
      title: 'Shared profile article',
      ...(classification === null ? {} : { classification }),
      slug: 'profile-article-' + randomUUID(),
      excerpt: 'A reviewed summary.',
      byline: 'Public profile owner',
      category: 'Guides',
      tags: ['profiles'],
      sections: [
        {
          heading: 'Profile evidence',
          paragraphs: ['A real published article for profile composition.'],
        },
      ],
    },
  });
  const records = [
    ['app', 'application-drafts', 'application-reviews', application],
    ['suite', 'suites', 'suite-reviews', suite],
    ['article', 'articles', 'article-reviews', article],
  ];
  for (const [, workspace, reviews, record] of records.slice(1))
    await publish(workspace, reviews, record);
  const base = '/api/profiles/' + owner.publicId;
  if (checkLag)
    for (const section of ['suites', 'articles'])
      await call(base + '/' + section, { at, status: 503 });
  for (const [kind, , , record] of records)
    await services.project(kind, record.id);
  if (saveFavorite) {
    const favorites = await call('/api/me/favorites', {
      at,
      token: owner.token,
    });
    await call('/api/me/favorites', {
      at,
      token: owner.token,
      method: 'PUT',
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        expectedRevision: favorites.revision,
        target: { kind: 'applications', id: application.id },
        saved: true,
      },
    });
  }
  const topicPath = '/api/application-discussions/' + application.id;
  const topic = await call(topicPath, {
    at,
    token: owner.token,
    status: 201,
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      title: 'Shared profile discussion',
      tags: ['profiles'],
      displayName: 'Public owner',
      text: 'A real stored discussion contribution.',
    },
  });
  if (checkLag) await call(base + '/discussions', { at, status: 503 });
  if (startWorker) services.startWorker();
  for (let attempt = 0; ; attempt++) {
    services.assertWorker();
    const response = await fetch(at + topicPath + '/' + topic.id, {
      signal: AbortSignal.timeout(10000),
    });
    const value = await response.json();
    if (response.status === 200 && value.revision === topic.revision) break;
    assert.ok(
      response.status === 503 || response.status === 200,
      JSON.stringify(value)
    );
    assert(attempt < 100, 'Discussion projection did not catch up');
    await delay(100);
  }
  const ids = {
    favorites: application.id,
    suites: suite.id,
    articles: article.id,
    discussions: topic.id,
  };
  return {
    ids,
    application,
    suite,
    article,
    topic,
    withdraw: async () => {
      // Keep the previous projections to prove canonical withdrawal overrides stale content.
      for (const [, workspace, , record] of [...records].reverse()) {
        const current = await editorial(
          `me/${workspace}/${record.id}/publication`
        );
        await editorial(`me/${workspace}/${record.id}/withdraw`, {
          status: 201,
          body: {
            expectedRevision: current.revision,
            ...(workspace === 'articles'
              ? { expectedPublicationRevision: current.publicationRevision }
              : {}),
          },
        });
      }
    },
  };
}

module.exports = { profileParityContent };
