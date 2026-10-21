const assert = require('node:assert/strict');
const {
  ContentClassification1791886000000,
} = require('../../apps/services/editorial/src/app/content-classification/content-classification.migration');
const {
  MysqlEditorialAccountExportSource,
} = require('../../apps/services/editorial/src/app/account-export/mysql-editorial-account-export-source');

module.exports = async function classificationChecks({
  call,
  headers,
  source,
  project,
  projections,
  read,
  applicationId,
  pass,
}) {
  const owner = headers('DraftBrowserAlice');
  const reviewer = headers('DraftBrowserReviewer', 'default', [
    'editorial:reviewer',
  ]);
  const specs = [
    {
      kind: 'app',
      type: 'application',
      base: 'me/application-drafts',
      review: 'editorial/application-reviews',
      fields: {
        name: 'Classification application general',
        slug: 'classification-application-general',
        website: 'https://example.test',
        description: 'A classified application with reviewed public content.',
      },
    },
    {
      kind: 'article',
      type: 'article',
      base: 'me/articles',
      review: 'editorial/article-reviews',
      fields: {
        title: 'Classification article general',
        slug: 'classification-article-general',
        excerpt: 'A classified article summary.',
        byline: 'Classification author',
        category: 'Classification',
        tags: [],
        sections: [
          { heading: '', paragraphs: ['Reviewed content classification.'] },
        ],
      },
    },
    {
      kind: 'suite',
      type: 'suite',
      base: 'me/suites',
      review: 'editorial/suite-reviews',
      fields: {
        title: 'Classification suite general',
        description: 'A classified collection.',
        applicationIds: [applicationId],
      },
    },
  ];
  async function status(spec, id) {
    return call(`${spec.base}/${id}/publication`, 'GET', undefined, owner);
  }
  async function submit(spec, id) {
    const current = await status(spec, id);
    return call(
      `${spec.base}/${id}/submit`,
      'POST',
      {
        expectedRevision: current.revision,
        ...(spec.kind === 'article'
          ? { expectedPublicationRevision: current.publicationRevision }
          : {}),
      },
      owner,
      201
    );
  }
  async function decision(spec, id, actor = reviewer, expected = 201, key) {
    const current = await status(spec, id);
    return call(
      `${spec.review}/${id}/decision`,
      'POST',
      {
        decision: 'approve',
        expectedRevision: current.revision,
        submittedRevision: current.latestSubmission.submittedRevision,
        reason: '',
        ...(spec.kind === 'article'
          ? { expectedPublicationRevision: current.publicationRevision }
          : {}),
      },
      actor,
      expected,
      key
    );
  }
  for (const spec of specs) {
    const created = await call(
      spec.base,
      'POST',
      { ...spec.fields, classification: 'mature' },
      owner,
      201
    );
    spec.id = created.id;
    spec.variants = [
      { id: created.id, classification: 'general', ...spec.fields },
    ];
    await call(
      `${spec.base}/${spec.id}`,
      'GET',
      undefined,
      headers('DraftBrowserBob'),
      404
    );
    await call(
      `${spec.base}/${spec.id}`,
      'GET',
      undefined,
      headers('DraftBrowserAlice', 'other'),
      404
    );
    await submit(spec, spec.id);
    await decision(
      spec,
      spec.id,
      headers('DraftBrowserAlice', 'default', ['editorial:reviewer']),
      403
    );
    await call(
      `${spec.base}/${spec.id}`,
      'PUT',
      { ...spec.fields, classification: 'general', expectedRevision: 2 },
      owner
    );
    assert.equal(
      (await status(spec, spec.id)).latestSubmission.classification,
      'mature'
    );
    await decision(spec, spec.id);
    await project(spec.kind, spec.id);
    const stale = await projections.find(spec.kind, spec.id);
    const query = 'search=Classification&type=' + spec.type + '&pageSize=100';
    assert.equal(
      (await read(query)).groups[0].items[0].classification,
      'mature'
    );
    await submit(spec, spec.id);
    const before = await status(spec, spec.id);
    assert.match(spec.id, /^[a-f0-9-]{36}$/);
    await source.query(
      `CREATE TRIGGER classification_atomicity BEFORE INSERT ON editorial_outbox FOR EACH ROW BEGIN IF NEW.resourceId='${spec.id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='qualification rollback'; END IF; END`
    );
    const key = `classification-rollback-${spec.kind}`;
    try {
      await decision(spec, spec.id, reviewer, 503, key);
      assert.deepEqual(await status(spec, spec.id), before);
      assert.equal(
        (await read(query)).groups[0].items[0].classification,
        'mature'
      );
    } finally {
      await source.query('DROP TRIGGER classification_atomicity');
    }
    await decision(spec, spec.id, reviewer, 201, key);
    await read(query, 503);
    await project(spec.kind, spec.id);
    assert.equal(
      (await read(query)).groups[0].items[0].classification,
      'general'
    );
    await projections.publish(stale);
    assert.equal(
      (await read(query)).groups[0].items[0].classification,
      'general'
    );
    for (const classification of ['mature', undefined]) {
      const label = classification ?? 'unclassified';
      const fields = {
        ...spec.fields,
        ...(classification ? { classification } : {}),
      };
      if ('name' in fields) fields.name = `Classification application ${label}`;
      if ('title' in fields)
        fields.title = `Classification ${spec.kind} ${label}`;
      if ('slug' in fields)
        fields.slug = `classification-${spec.type}-${label}`;
      const draft = await call(spec.base, 'POST', fields, owner, 201);
      spec.variants.push({ id: draft.id, ...fields });
      await submit(spec, draft.id);
      await decision(spec, draft.id);
      await project(spec.kind, draft.id);
    }
    const group = (await read(query)).groups[0];
    assert.equal(group.total, 3);
    assert.deepEqual(
      group.items.map((item) => item.classification),
      ['general', 'mature', undefined]
    );
  }
  pass(
    'Classifications use frozen submissions: private edits, self-review/tenant denial, transactional rollback/retry, exact projection lag and stale replay checked for all three kinds'
  );
  const noImages = {
    read: async () => assert.fail('Classification records have no images'),
  };
  const exporter = new MysqlEditorialAccountExportSource(source, {
    applications: noImages,
    articles: noImages,
  });
  const exported = [];
  for await (const entry of exporter.capture(
    'DraftBrowserAlice',
    new AbortController().signal
  ))
    if (entry.type === 'record') exported.push(entry);
  for (const [collection, idField] of [
    ['applications.drafts', 'id'],
    ['suites.drafts', 'id'],
    ['articles.drafts', 'id'],
    ['catalog', 'resourceId'],
    ['suites.publications', 'suiteId'],
    ['articles.publications', 'articleId'],
  ]) {
    const values = exported.filter((entry) => entry.collection === collection);
    assert.equal(values.length, 3, collection);
    const approved = values.find((entry) =>
      specs.some((spec) => spec.id === entry.data[idField])
    );
    assert.equal(approved.data.content.classification, 'general', collection);
    assert.deepEqual(
      values
        .map((entry) => entry.data.content.classification ?? 'unclassified')
        .sort(),
      ['general', 'mature', 'unclassified']
    );
  }
  for (const collection of [
    'applications.submissions',
    'suites.submissions',
    'articles.submissions',
  ])
    assert.deepEqual(
      exported
        .filter((entry) => entry.collection === collection)
        .map((entry) => entry.data.classification ?? 'unclassified')
        .sort(),
      ['general', 'mature', 'mature', 'unclassified']
    );
  pass(
    'Canonical account export preserves reviewed, proposed and legacy unclassified values in drafts, frozen submissions and public content'
  );
  const application = specs[0];
  const direct = await call(
    application.base,
    'POST',
    {
      ...application.fields,
      name: 'Unreviewed application edit',
      slug: 'unreviewed-application-edit',
      classification: 'general',
    },
    owner,
    201
  );
  await submit(application, direct.id);
  await decision(application, direct.id);
  await project('app', direct.id);
  const previous = await projections.find('app', direct.id);
  await call(
    'apps/' + direct.id,
    'PUT',
    {
      description: 'Changed outside publication review.',
      expectedRevision: (
        await status(application, direct.id)
      ).publicationRevision,
    },
    headers('DraftBrowserAlice', 'default', ['editorial:publisher'])
  );
  await read('search=Unreviewed&type=application', 503);
  await project('app', direct.id);
  assert.equal(
    (await read('search=Unreviewed&type=application')).groups[0].items[0]
      .classification,
    undefined
  );
  await projections.publish(previous);
  assert.equal(
    (await read('search=Unreviewed&type=application')).groups[0].items[0]
      .classification,
    undefined
  );
  pass(
    'Direct privileged application writes invalidate reviewed classification; stale projection replay cannot restore it'
  );
  const runner = source.createQueryRunner();
  try {
    await new ContentClassification1791886000000().up(runner);
    await source.query(
      'ALTER TABLE private_suites RENAME COLUMN classification TO saved_classification'
    );
    try {
      await assert.rejects(
        new ContentClassification1791886000000().up(runner),
        /Applied classification column is missing/
      );
    } finally {
      await source.query(
        'ALTER TABLE private_suites RENAME COLUMN saved_classification TO classification'
      );
    }
    await new ContentClassification1791886000000().up(runner);
    await assert.rejects(
      new ContentClassification1791886000000().down(),
      /retain the additive schema/
    );
  } finally {
    await runner.release();
  }
  pass(
    'Real classification migration replay preserves data and refuses recorded column loss and destructive rollback'
  );
  const publisher = headers('DraftBrowserAlice', 'default', [
    'editorial:publisher',
    'editorial:taxonomy',
  ]);
  const category = await call(
    'categories',
    'POST',
    {
      name: 'Classification tools',
      slug: 'classification-tools',
    },
    publisher,
    201
  );
  await project('category', category.id);
  for (const variant of specs[0].variants) {
    await call(
      'apps/' + variant.id,
      'PUT',
      {
        categoryId: category.id,
        expectedRevision: (
          await status(specs[0], variant.id)
        ).publicationRevision,
      },
      publisher
    );
    const draft = await call(
      specs[0].base + '/' + variant.id,
      'GET',
      undefined,
      owner
    );
    await call(
      specs[0].base + '/' + variant.id,
      'PUT',
      {
        name: variant.name,
        slug: variant.slug,
        website: variant.website,
        description: variant.description,
        ...(variant.classification
          ? { classification: variant.classification }
          : {}),
        expectedRevision: draft.revision,
      },
      owner
    );
    await submit(specs[0], variant.id);
    await decision(specs[0], variant.id);
    await project('app', variant.id);
  }
  const mixedSuite = specs[2];
  const current = await call(
    mixedSuite.base + '/' + mixedSuite.id,
    'GET',
    undefined,
    owner
  );
  await call(
    mixedSuite.base + '/' + mixedSuite.id,
    'PUT',
    {
      ...mixedSuite.fields,
      classification: 'general',
      applicationIds: specs[0].variants.map((variant) => variant.id),
      expectedRevision: current.revision,
    },
    owner
  );
  await submit(mixedSuite, mixedSuite.id);
  await decision(mixedSuite, mixedSuite.id);
  await project('suite', mixedSuite.id);
  pass(
    'Public consumer fixtures use reviewed app taxonomy and a General suite with General, Mature and unclassified members'
  );
  return specs;
};
