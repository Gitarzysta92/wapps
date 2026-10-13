const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

// Publications go through real author commands and independent staff approval.
module.exports = async function feedContentPreferencesFixture(options) {
  const { editorialOrigin, discussionOrigin, headers, owner } = options;
  const reviewer = {
    ...headers('FeedClassificationReviewer'),
    'x-user-claims': JSON.stringify({
      roles: ['editorial:reviewer'],
      tenantId: 'default',
    }),
  };
  async function call(
    origin,
    route,
    method = 'GET',
    body,
    actor = headers(owner),
    status = 200
  ) {
    const response = await fetch(origin() + '/api/' + route, {
      method,
      headers: { ...actor, 'idempotency-key': randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
    const value = await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${route}: ${JSON.stringify(value)}`
    );
    return value;
  }
  const specs = {
    app: {
      base: 'me/application-drafts',
      review: 'editorial/application-reviews',
    },
    article: { base: 'me/articles', review: 'editorial/article-reviews' },
    suite: { base: 'me/suites', review: 'editorial/suite-reviews' },
  };
  const state = (item) =>
    call(editorialOrigin, `${item.base}/${item.id}/publication`);
  async function submit(item) {
    const current = await state(item);
    await call(
      editorialOrigin,
      `${item.base}/${item.id}/submit`,
      'POST',
      {
        expectedRevision: current.revision,
        ...(item.kind === 'article'
          ? { expectedPublicationRevision: current.publicationRevision }
          : {}),
      },
      headers(owner),
      201
    );
  }
  async function approve(item) {
    const current = await state(item);
    await call(
      editorialOrigin,
      `${item.review}/${item.id}/decision`,
      'POST',
      {
        decision: 'approve',
        expectedRevision: current.revision,
        submittedRevision: current.latestSubmission.submittedRevision,
        reason: '',
        ...(item.kind === 'article'
          ? { expectedPublicationRevision: current.publicationRevision }
          : {}),
      },
      reviewer,
      201
    );
  }
  async function edit(item, classification) {
    const current = await call(editorialOrigin, `${item.base}/${item.id}`);
    return call(editorialOrigin, `${item.base}/${item.id}`, 'PUT', {
      ...item.fields,
      classification,
      expectedRevision: current.revision,
    });
  }
  const applications = {},
    articles = {},
    suites = {},
    topics = {},
    reviews = {};
  async function publish(kind, label, classification) {
    const fields =
      kind === 'app'
        ? {
            name: `Feed preference application ${label}`,
            slug: `feed-preference-application-${label}`,
            website: 'https://example.test',
            description:
              'A reviewed application for current feed content preferences.',
          }
        : kind === 'article'
        ? {
            title: `Feed preference article ${label}`,
            slug: `feed-preference-article-${label}`,
            excerpt: 'A reviewed article summary for content preferences.',
            byline: 'Feed preference author',
            category: 'Preferences',
            tags: [],
            sections: [
              {
                heading: '',
                paragraphs: ['Reviewed feed preference content.'],
              },
            ],
          }
        : {
            title: `Feed preference suite ${label}`,
            description: 'A reviewed suite with its own classification.',
            applicationIds: [applications.general.id],
          };
    const created = await call(
      editorialOrigin,
      specs[kind].base,
      'POST',
      {
        ...fields,
        ...(classification === undefined ? {} : { classification }),
      },
      headers(owner),
      201
    );
    const item = {
      ...specs[kind],
      kind,
      id: created.id,
      fields,
      classification,
    };
    await submit(item);
    await approve(item);
    await options.projectPublication(kind, item.id);
    return item;
  }
  for (const value of ['general', 'mature', 'unclassified'])
    applications[value] = await publish(
      'app',
      value,
      value === 'unclassified' ? undefined : value
    );
  for (const value of ['mature', 'unclassified', 'general']) {
    const classification = value === 'unclassified' ? undefined : value;
    articles[value] = await publish('article', value, classification);
    suites[value] = await publish('suite', value, classification);
    topics[value] = await call(
      discussionOrigin,
      `application-discussions/${applications[value].id}`,
      'POST',
      {
        title: `Feed preference discussion ${value}`,
        tags: ['preferences'],
        displayName: 'Feed preference member',
        text: 'A real discussion inheriting the current approved application classification.',
      },
      headers(owner),
      201
    );
    await options.project(topics[value].id);
    reviews[value] = await call(
      discussionOrigin,
      `application-reviews/${applications[value].id}/mine`,
      'PUT',
      {
        expectedRevision: 0,
        content: {
          displayName: 'Feed preference reviewer',
          rating: 4,
          text: 'A real review inheriting its approved application classification.',
        },
      }
    );
  }
  return {
    applications,
    articles,
    suites,
    topics,
    reviews,
    publish,
    edit,
    submit,
    approve,
  };
};
