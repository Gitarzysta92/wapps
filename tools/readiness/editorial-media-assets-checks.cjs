const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const base = '../../apps/services/editorial/src/app/';
const { ApplicationOwnership } = require(base +
  'application-ownership/application-ownership');
const { MysqlApplicationOwnership } = require(base +
  'application-ownership/mysql-application-ownership');
const { MysqlEditorialContributionErasure } = require(base +
  'account-erasure/mysql-editorial-contribution-erasure');
const {
  MysqlAccountErasureParticipant,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');
const { EditorialMediaAssets1791840011000 } = require(base +
  'application-media/editorial-media-assets.migration');
const { ApplicationImageBindings1791676815000 } = require(base +
  'application-media/application-image-bindings.migration');
const { ArticleCoverReferences1791676820000 } = require(base +
  'article-covers/article-cover-references.migration');
const {
  applicationMediaAsset,
  articleMediaAsset,
  recordEditorialMediaAsset,
} = require(base + 'application-media/editorial-media-assets');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');
const { applicationImageObjectKey } = require(base +
  'application-media/s3-application-images');
const { articleCoverObjectKey } = require(base +
  'article-covers/article-cover-storage');

module.exports = async function editorialMediaAssetsChecks({
  source,
  origin,
  restart,
  secret,
  pass,
  policy,
  reader,
  projections,
  qualifyBrowser,
  qualifyRetirement,
  qualifyWorkspaceErasure,
  qualifyParticipant,
  storage,
}) {
  assert.equal(source.options.database, 'suites');
  const actor = (identityId, roles = [], tenantId = 'default') => ({
    identityId,
    roles,
    tenantId,
  });
  const owner = actor('RetainedMediaAuthor');
  const successor = actor('RetainedMediaSuccessor');
  const staff = actor('RetainedMediaStaff', [
    'editorial:reviewer',
    'editorial:ownership-reviewer',
  ]);
  const ownership = new ApplicationOwnership(
    new MysqlApplicationOwnership(source),
    { matches: async () => true },
    policy,
    { id: randomUUID, token: () => randomBytes(32).toString('hex') }
  );
  const bytes = await sharp({
    create: { width: 320, height: 180, channels: 3, background: '#277d74' },
  })
    .png()
    .toBuffer();
  async function request(method, route, body, current = owner, headers = {}) {
    return fetch(origin() + '/api/' + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        ...(current
          ? {
              'x-user-id': current.identityId,
              'x-user-claims': JSON.stringify({
                tenantId: current.tenantId,
                roles: current.roles,
              }),
              'x-ingress-auth': secret,
            }
          : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  }
  async function json(status, method, route, body, current = owner, headers) {
    const response = await request(method, route, body, current, headers);
    const value = await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${route}: ${JSON.stringify(value)}`
    );
    return value;
  }
  async function image(route, current = null) {
    const response = await request('GET', route, undefined, current);
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    return Buffer.from(await response.arrayBuffer());
  }
  async function upload(kind, input) {
    const family =
      kind === 'application' ? 'application-images' : 'article-covers';
    const table =
      kind === 'application' ? 'application_image' : 'article_cover';
    const reserved = await json(201, 'POST', 'me/' + family, {
      ...input,
      source: {
        contentType: 'image/png',
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    });
    const route = `me/${family}/${reserved.id}`;
    const headers = {
      'content-type': 'application/octet-stream',
      'if-match': '"1"',
      'idempotency-key': randomUUID(),
    };
    await source.query(
      "CREATE TRIGGER qualification_asset_failure BEFORE INSERT ON editorial_media_assets FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected descriptor failure'"
    );
    try {
      await json(503, 'PUT', route + '/content', bytes, owner, headers);
    } finally {
      await source.query('DROP TRIGGER qualification_asset_failure');
    }
    const client = new S3Client(storage);
    try {
      const object = await client.send(
        new HeadObjectCommand({
          Bucket: 'retained-media',
          Key: (kind === 'application'
            ? applicationImageObjectKey
            : articleCoverObjectKey)(reserved.id),
        })
      );
      assert.ok(
        object.ContentLength > 0,
        'immutable bytes precede the injected metadata failure'
      );
    } finally {
      client.destroy();
    }
    const [pending] = await source.query(
      `SELECT * FROM ${table}_uploads WHERE id=?`,
      [reserved.id]
    );
    assert.equal(pending.status, 'pending');
    assert.equal(pending.asset, null);
    assert.equal(Number(pending.revision), 1);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=?',
          [kind, reserved.id]
        )
      ).length,
      0
    );
    const [receipt] = await source.query(
      `SELECT receipt FROM ${table}_commands WHERE commandKey=?`,
      [headers['idempotency-key']]
    );
    assert.equal(receipt.receipt, null);
    const ready = await json(
      200,
      'PUT',
      route + '/content',
      bytes,
      owner,
      headers
    );
    assert.equal(ready.status, 'ready');
    assert.deepEqual(
      await json(200, 'PUT', route + '/content', bytes, owner, headers),
      ready
    );
    const descriptor = await json(200, 'GET', route);
    const normalized = await image(route + '/content', owner);
    assert.equal(
      createHash('sha256').update(normalized).digest('hex'),
      descriptor.asset.sha256
    );
    const [stored] = await source.query(
      'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=?',
      [kind, reserved.id]
    );
    assert.deepEqual(
      typeof stored.asset === 'string'
        ? JSON.parse(stored.asset)
        : stored.asset,
      descriptor.asset
    );
    assert.equal(JSON.stringify(stored).includes(owner.identityId), false);
    return { id: reserved.id, bytes: normalized, descriptor: stored };
  }
  const fields = {
    name: 'Retained media application',
    slug: 'retained-media-app',
    website: 'https://retained.example.test',
    description: 'Published images survive uploader history removal.',
  };
  const app = await json(201, 'POST', 'me/application-drafts', fields);
  const logo = await upload('application', {
    draftId: app.id,
    purpose: 'logo',
  });
  const selected = await json(
    200,
    'PUT',
    `me/application-drafts/${app.id}/images`,
    { imageId: logo.id, purpose: 'logo', expectedRevision: app.revision }
  );
  const submitted = await json(
    201,
    'POST',
    `me/application-drafts/${app.id}/submit`,
    { expectedRevision: selected.revision }
  );
  await json(
    201,
    'POST',
    `editorial/application-reviews/${app.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: submitted.revision,
      submittedRevision: submitted.submittedRevision,
    },
    staff
  );
  const articleFields = {
    title: 'Retained article media',
    slug: 'retained-media-article',
    excerpt: 'An anonymous article retains its approved cover.',
    byline: 'Original retained-media author',
    category: 'Guides',
    tags: [],
    sections: [
      {
        heading: 'Retained content',
        paragraphs: [
          'The public article and its approved image remain available.',
        ],
      },
    ],
  };
  const article = await json(201, 'POST', 'me/articles', articleFields);
  const cover = await upload('article', { articleId: article.id });
  await json(200, 'PUT', `me/articles/${article.id}`, {
    ...articleFields,
    cover: { imageId: cover.id, alt: 'Green retained article cover' },
    expectedRevision: article.revision,
  });
  let state = await json(200, 'GET', `me/articles/${article.id}/publication`);
  await json(201, 'POST', `me/articles/${article.id}/submit`, {
    expectedRevision: state.revision,
    expectedPublicationRevision: state.publicationRevision,
  });
  state = await json(200, 'GET', `me/articles/${article.id}/publication`);
  await json(
    201,
    'POST',
    `editorial/article-reviews/${article.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
      submittedRevision: state.latestSubmission.submittedRevision,
      reason: '',
    },
    staff
  );
  const appRoute = `media/applications/${app.id}/logo/${logo.id}`;
  const articleRoute = `media/articles/${article.id}/${cover.id}`;
  assert.deepEqual(await image(appRoute), logo.bytes);
  assert.deepEqual(await image(articleRoute), cover.bytes);
  pass(
    'both real upload families atomically register descriptors; injected SQL failure rolls back ready metadata/receipt and exact retry recovers immutable MinIO bytes; reviewed public HTTP bytes match private previews'
  );

  const claim = await ownership.create(
    successor,
    {
      applicationId: app.id,
      evidenceUrl: 'https://retained.example.test/team',
      notes: 'I control the official website for this application.',
    },
    randomUUID()
  );
  const proof = await ownership.change(
    successor,
    claim.id,
    'verify',
    { expectedRevision: claim.revision },
    randomUUID()
  );
  await ownership.change(
    staff,
    claim.id,
    'approve',
    { expectedRevision: proof.revision },
    randomUUID()
  );
  const canonical = await json(
    200,
    'GET',
    `me/application-drafts/canonical/${app.id}`,
    undefined,
    successor
  );
  const editing = await json(
    201,
    'POST',
    'me/application-drafts/from-application',
    {
      editing: {
        applicationId: app.id,
        claimId: claim.id,
        sourcePublicationRevision: canonical.sourcePublicationRevision,
      },
      fields: canonical.fields,
    },
    successor
  );
  const inheritedRoute = `me/application-drafts/${editing.id}/images/logo/content`;
  assert.deepEqual(await image(inheritedRoute, successor), logo.bytes);
  for (const [route, current, status] of [
    [inheritedRoute, owner, 404],
    [inheritedRoute, { ...successor, tenantId: 'other' }, 404],
    [`media/applications/${app.id}/banner/${logo.id}`, null, 404],
    [`media/applications/${randomUUID()}/logo/${logo.id}`, null, 404],
    [`media/articles/${randomUUID()}/${cover.id}`, null, 404],
    [`media/articles/${article.id}/${logo.id}`, null, 404],
  ])
    await json(status, 'GET', route, undefined, current);
  assert.equal(
    await applicationMediaAsset(source.manager, logo.id, 'other'),
    null
  );
  assert.equal(
    await articleMediaAsset(source.manager, cover.id, article.id, 'other'),
    null
  );
  assert.equal(
    await articleMediaAsset(source.manager, cover.id, randomUUID(), 'default'),
    null
  );
  const cleanupContext = {
    owner,
    successor,
    staff,
    ownership,
    app,
    article,
    logo,
    cover,
    json,
    bytes,
  };
  const eraseParticipant = qualifyParticipant
    ? await qualifyParticipant(cleanupContext)
    : null;
  const eraseWorkspace = qualifyWorkspaceErasure
    ? await qualifyWorkspaceErasure(cleanupContext)
    : null;
  const input = { identityId: owner.identityId, revision: 11 };
  const participant = new MysqlAccountErasureParticipant('editorial', source);
  const publish = async (kind, id) =>
    projections.publish(projectEditorialSnapshot(await reader.read(kind, id)));
  if (eraseParticipant) await eraseParticipant(input);
  else {
    assert.equal((await participant.request(input)).state, 'pending');
    const erasure = new MysqlEditorialContributionErasure(source);
    let calls = 0;
    while (await erasure.advance(input)) assert.ok(++calls < 10);
    await publish('app', app.id);
    await publish('article', article.id);
  }
  const [publicArticle] = await source.query(
    'SELECT ownerIdentityId,fields FROM article_publications WHERE articleId=?',
    [article.id]
  );
  assert.equal(publicArticle.ownerIdentityId, null);
  assert.equal(
    (typeof publicArticle.fields === 'string'
      ? JSON.parse(publicArticle.fields)
      : publicArticle.fields
    ).byline,
    'Deleted account'
  );
  const [publicApp] = await source.query(
    "SELECT ownerIdentityId FROM editorial_resource_states WHERE resourceKind='app' AND resourceId=?",
    [app.id]
  );
  assert.equal(publicApp.ownerIdentityId, successor.identityId);

  if (eraseWorkspace) await eraseWorkspace(input);
  // Registry-only modes retain their explicitly scoped legacy fixture.
  else if (!eraseParticipant)
    await source.transaction(async (manager) => {
      for (const [table, column, id] of [
        ['application_draft_images', 'draftId', app.id],
        ['application_submission_images', 'draftId', app.id],
        ['application_submissions', 'applicationId', app.id],
        ['application_draft_commands', 'draftId', app.id],
        ['application_publication_commands', 'applicationId', app.id],
        ['application_image_commands', 'imageId', logo.id],
        ['application_image_uploads', 'id', logo.id],
        ['application_drafts', 'id', app.id],
        ['article_submissions', 'articleId', article.id],
        ['article_commands', 'articleId', article.id],
        ['article_cover_commands', 'imageId', cover.id],
        ['article_cover_uploads', 'id', cover.id],
        ['article_drafts', 'id', article.id],
      ])
        await manager.query(`DELETE FROM ${table} WHERE ${column}=?`, [id]);
      await manager.query(
        "DELETE FROM article_cover_references WHERE articleId=? AND kind<>'publication'",
        [article.id]
      );
    });
  for (const [kind, media] of [
    ['application', logo],
    ['article', cover],
  ])
    assert.deepEqual(
      (
        await source.query(
          'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=?',
          [kind, media.id]
        )
      )[0],
      media.descriptor
    );
  await restart();
  assert.deepEqual(await image(appRoute), logo.bytes);
  assert.deepEqual(await image(articleRoute), cover.bytes);
  assert.deepEqual(await image(inheritedRoute, successor), logo.bytes);
  const inherited = await json(
    200,
    'GET',
    `me/application-drafts/${editing.id}`,
    undefined,
    successor
  );
  assert.equal(inherited.images.logo.asset.id, logo.id);
  const changed = await json(
    200,
    'PUT',
    `me/application-drafts/${editing.id}`,
    {
      ...canonical.fields,
      description: 'Successor continues editing retained images.',
      expectedRevision: inherited.revision,
    },
    successor
  );
  await json(
    201,
    'POST',
    `me/application-drafts/${editing.id}/submit`,
    { expectedRevision: changed.revision },
    successor
  );
  assert.deepEqual(await image(inheritedRoute, successor), logo.bytes);
  await json(
    404,
    'GET',
    `me/application-images/${logo.id}`,
    undefined,
    successor
  );
  pass(
    'after exact erasure barrier/anonymization and ' +
      (eraseParticipant
        ? 'production participant erasure'
        : eraseWorkspace
        ? 'production workspace erasure'
        : 'fixture removal') +
      ' of original private uploads/drafts/submissions/commands, public app and anonymous article bytes survive restart; a legitimate successor retains and submits inherited media with tenant/association isolation'
  );

  const runner = source.createQueryRunner();
  try {
    await new EditorialMediaAssets1791840011000().up(runner);
    await new ApplicationImageBindings1791676815000().up(runner);
    await new ArticleCoverReferences1791676820000().up(runner);
    await assert.rejects(
      source.transaction((manager) =>
        recordEditorialMediaAsset(manager, {
          ...logo.descriptor,
          createdAt: Number(logo.descriptor.createdAt),
          asset: { ...inherited.images.logo.asset, width: 1 },
        })
      ),
      /conflicts/
    );
    await source.query(
      "UPDATE editorial_media_assets SET tenantId='other' WHERE kind='application' AND imageId=?",
      [logo.id]
    );
    await assert.rejects(
      new EditorialMediaAssets1791840011000().up(runner),
      /relationships/
    );
    await source.query(
      "UPDATE editorial_media_assets SET tenantId='default' WHERE kind='application' AND imageId=?",
      [logo.id]
    );
    await new EditorialMediaAssets1791840011000().up(runner);
  } finally {
    await runner.release();
  }
  pass(
    'registry and predecessor association migrations reenter without uploader history; immutable descriptor overwrite and cross-tenant inherited reference corruption are rejected'
  );
  if (qualifyRetirement) {
    await qualifyRetirement({
      logo,
      cover,
      articleId: article.id,
      draftId: editing.id,
    });
    assert.deepEqual(await image(appRoute), logo.bytes);
    assert.deepEqual(await image(articleRoute), cover.bytes);
    assert.deepEqual(await image(inheritedRoute, successor), logo.bytes);
  }
  if (qualifyBrowser)
    await qualifyBrowser({
      fields: articleFields,
      articleId: article.id,
      coverId: cover.id,
      bytes: cover.bytes,
    });
  await require('./editorial-media-assets-migration-checks.cjs')({
    source,
    pass,
  });
};
