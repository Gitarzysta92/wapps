const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { ConfigService } = require('@nestjs/config');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const base = '../../apps/services/editorial/src/app/';
const { ConfiguredArticleCoverObjects, articleCoverObjectKey } = require(base +
  'article-covers/article-cover-storage');
const { ArticleCoverCleanup } = require(base +
  'article-covers/article-cover-cleanup');
const { MysqlArticleCoverCleanup } = require(base +
  'article-covers/mysql-article-cover-cleanup');
const { ArticleCoverReads } = require(base +
  'article-covers/article-cover-reads');
const { MysqlArticleCoverReads } = require(base +
  'article-covers/mysql-article-cover-reads');
const { ArticleCovers1791676819000 } = require(base +
  'article-covers/article-covers.migration');
const { ArticleCoverReferences1791676820000 } = require(base +
  'article-covers/article-cover-references.migration');
const { ArticleCoverCleanup1791676821000 } = require(base +
  'article-covers/article-cover-cleanup.migration');
const { ArticleWorkspace1791676818000 } = require(base +
  'articles/article-workspace.migration');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');

async function articleCoverPublicationChecks({
  source,
  origin,
  restart,
  secret,
  pass,
  objects: configuration,
  policy,
  reader,
  projections,
  broker,
}) {
  const owner = {
    identityId: 'HttpCoverAuthor',
    tenantId: 'default',
    roles: [],
  };
  const reviewer = {
    identityId: 'CoverReviewer',
    tenantId: 'default',
    roles: ['editorial:reviewer'],
  };
  const outsider = { ...owner, identityId: 'OtherCoverAuthor' };
  const fields = {
    title: 'Reviewing an article cover',
    slug: 'article-cover-' + randomUUID(),
    excerpt: 'The cover is reviewed with the exact article text.',
    byline: 'Public writer',
    category: 'Guides',
    tags: [],
    sections: [
      { heading: 'Article', paragraphs: ['A complete article body.'] },
    ],
  };
  const bytes = await sharp({
    create: { width: 320, height: 180, channels: 3, background: 'green' },
  })
    .png()
    .toBuffer();
  const different = await sharp({
    create: { width: 120, height: 60, channels: 3, background: 'blue' },
  })
    .png()
    .toBuffer();
  const descriptor = (data) => ({
    contentType: 'image/png',
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  });
  const headers = (actor) =>
    actor
      ? {
          'x-user-id': actor.identityId,
          'x-user-claims': JSON.stringify({
            tenantId: actor.tenantId,
            roles: actor.roles,
          }),
          'x-ingress-auth': secret,
        }
      : {};
  async function request(method, route, body, actor = owner, extra = {}) {
    return fetch(origin() + '/api/' + route, {
      method,
      headers: {
        ...headers(actor),
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        ...extra,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
  }
  async function json(
    expected,
    method,
    route,
    body,
    actor = owner,
    extra = {}
  ) {
    const response = await request(method, route, body, actor, extra);
    const value = await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${route}: ${JSON.stringify(value)}`
    );
    return value;
  }
  const createDraft = async () =>
    json(201, 'POST', 'me/articles', {
      ...fields,
      slug: 'article-cover-' + randomUUID(),
    });
  const draft = await createDraft();
  const id = draft.id,
    route = 'me/articles/' + id;
  const input = { articleId: id, source: descriptor(bytes) };
  const createKey = randomUUID();
  const first = await json(201, 'POST', 'me/article-covers', input, owner, {
    'idempotency-key': createKey,
  });
  assert.deepEqual(
    await json(201, 'POST', 'me/article-covers', input, owner, {
      'idempotency-key': createKey,
    }),
    first
  );
  const uploadPath = 'me/article-covers/' + first.id;
  const binary = {
    'content-type': 'application/octet-stream',
    'if-match': '"1"',
  };
  for (const actor of [
    null,
    outsider,
    { ...owner, tenantId: 'other' },
    { ...outsider, roles: ['admin'] },
  ]) {
    await json(actor ? 404 : 401, 'GET', uploadPath, undefined, actor);
    await json(
      actor ? 404 : 401,
      'PUT',
      uploadPath + '/content',
      bytes,
      actor,
      binary
    );
  }
  await json(415, 'PUT', uploadPath + '/content', bytes, owner, {
    ...binary,
    'content-type': 'image/png',
  });
  await json(400, 'PUT', uploadPath + '/content', bytes, owner, {
    ...binary,
    'if-match': '1',
  });
  await json(400, 'PUT', uploadPath + '/content', different, owner, binary);
  const contentKey = randomUUID();
  const ready = await json(200, 'PUT', uploadPath + '/content', bytes, owner, {
    ...binary,
    'idempotency-key': contentKey,
  });
  assert.equal(ready.status, 'ready');
  await restart();
  assert.deepEqual(
    await json(200, 'PUT', uploadPath + '/content', bytes, owner, {
      ...binary,
      'idempotency-key': contentKey,
    }),
    ready
  );
  const uploaded = await json(200, 'GET', uploadPath);
  const cover = {
    imageId: first.id,
    alt: 'Green background for the reviewed article',
  };
  const draftFields = await json(200, 'GET', route);
  const content = { ...fields, slug: draftFields.slug };
  await json(404, 'PUT', route, {
    ...content,
    cover: { ...cover, imageId: randomUUID() },
    expectedRevision: 1,
  });
  await json(400, 'PUT', route, {
    ...content,
    cover: { ...cover, alt: '' },
    expectedRevision: 1,
  });
  const otherDraft = await createDraft();
  await json(404, 'PUT', 'me/articles/' + otherDraft.id, {
    ...content,
    slug: 'another-' + randomUUID(),
    cover,
    expectedRevision: 1,
  });
  await json(200, 'PUT', route, { ...content, cover, expectedRevision: 1 });
  await json(409, 'DELETE', uploadPath, { expectedRevision: 2 });
  const preview = await request('GET', uploadPath + '/content');
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('cache-control'), 'private, no-store');
  assert.equal(preview.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(
    preview.headers.get('content-security-policy'),
    "default-src 'none'; sandbox"
  );
  const approvedBytes = Buffer.from(await preview.arrayBuffer());
  assert.equal(
    createHash('sha256').update(approvedBytes).digest('hex'),
    uploaded.asset.sha256
  );
  pass(
    'compiled cover API: exact retries survive restart; tenant/owner/admin isolation, input bounds and article-specific attachment'
  );

  async function status() {
    return json(200, 'GET', route + '/publication');
  }
  async function transition(
    action,
    actor = owner,
    key = randomUUID(),
    expected = 201
  ) {
    const state = await status();
    const body = {
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
    };
    if (action === 'approve' || action === 'reject')
      Object.assign(body, {
        decision: action,
        submittedRevision: state.latestSubmission.submittedRevision,
        reason: action === 'reject' ? 'Needs a different cover' : '',
      });
    return json(
      expected,
      'POST',
      action === 'approve' || action === 'reject'
        ? 'editorial/article-reviews/' + id + '/decision'
        : route + '/' + action,
      body,
      actor,
      { 'idempotency-key': key }
    );
  }
  await transition('submit');
  const submitted = await status();
  const second = await json(201, 'POST', 'me/article-covers', {
    articleId: id,
    source: descriptor(different),
  });
  await json(
    200,
    'PUT',
    'me/article-covers/' + second.id + '/content',
    different,
    owner,
    binary
  );
  const secondCover = {
    imageId: second.id,
    alt: 'Blue replacement, still private',
  };
  await json(200, 'PUT', route, {
    ...content,
    cover: secondCover,
    expectedRevision: submitted.revision,
  });
  const reviewPath = `editorial/article-reviews/${id}/submissions/${submitted.latestSubmission.submittedRevision}/cover`;
  for (const actor of [owner, { ...owner, roles: ['admin'] }]) {
    await json(403, 'GET', reviewPath, undefined, actor);
    await transition('approve', actor, randomUUID(), 403);
  }
  const reviewed = await request('GET', reviewPath, undefined, reviewer);
  assert.equal(reviewed.status, 200);
  assert.deepEqual(Buffer.from(await reviewed.arrayBuffer()), approvedBytes);
  await json(
    404,
    'GET',
    reviewPath.replace(
      '/submissions/' + submitted.latestSubmission.submittedRevision,
      '/submissions/999'
    ),
    undefined,
    reviewer
  );
  assert.equal(
    (
      await request(
        'GET',
        'media/articles/' + id + '/' + first.id,
        undefined,
        null
      )
    ).status,
    404
  );
  await json(409, 'DELETE', uploadPath, { expectedRevision: 2 });
  const approveKey = randomUUID();
  await source.query(
    "CREATE TRIGGER reject_cover_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification outbox failure'"
  );
  try {
    await transition('approve', reviewer, approveKey, 503);
    assert.equal(
      (
        await source.query(
          'SELECT imageId FROM article_cover_references WHERE articleId = ? AND kind = ?',
          [id, 'publication']
        )
      ).length,
      0
    );
    assert.equal((await status()).latestSubmission.status, 'submitted');
  } finally {
    await source.query('DROP TRIGGER reject_cover_outbox');
  }
  const approval = await transition('approve', reviewer, approveKey);
  const firstProjection = projectEditorialSnapshot(
    await reader.read('article', id)
  );
  assert.deepEqual(firstProjection.content.cover, cover);
  assert.equal(
    (await request('GET', 'catalog/articles/' + content.slug, undefined, null))
      .status,
    503
  );
  await projections.publish(firstProjection);
  assert.deepEqual(
    (
      await json(
        200,
        'GET',
        'catalog/articles/' + content.slug,
        undefined,
        null
      )
    ).cover,
    cover
  );
  const publicRead = await request(
    'GET',
    'media/articles/' + id + '/' + first.id,
    undefined,
    null
  );
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await publicRead.arrayBuffer()), approvedBytes);
  assert.equal(
    (
      await request(
        'GET',
        'media/articles/' + id + '/' + second.id,
        undefined,
        null
      )
    ).status,
    404
  );
  pass(
    'frozen cover and description survive private edits; independent review, atomic publication/outbox rollback and complete materialization'
  );

  await transition('submit');
  await transition('approve', reviewer);
  await projections.publish(
    projectEditorialSnapshot(await reader.read('article', id))
  );
  assert.equal(
    (
      await request(
        'GET',
        'media/articles/' + id + '/' + first.id,
        undefined,
        null
      )
    ).status,
    404
  );
  assert.equal(
    (
      await request(
        'GET',
        'media/articles/' + id + '/' + second.id,
        undefined,
        null
      )
    ).status,
    200
  );
  await json(200, 'DELETE', uploadPath, { expectedRevision: 2 });
  const objects = new ConfiguredArticleCoverObjects(
    new ConfigService({
      EDITORIAL_MEDIA_ENDPOINT: configuration.endpoint,
      EDITORIAL_MEDIA_BUCKET: 'private-article-covers',
      EDITORIAL_MEDIA_ACCESS_KEY: configuration.accessKeyId,
      EDITORIAL_MEDIA_SECRET_KEY: configuration.secretAccessKey,
    })
  );
  const client = new S3Client({
    region: 'us-east-1',
    endpoint: configuration.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
    maxAttempts: 2,
  });
  const cleanup = new MysqlArticleCoverCleanup(source);
  let now = Date.now() + 8 * 24 * 60 * 60 * 1000;
  const worker = new ArticleCoverCleanup(cleanup, objects, () => now);
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    const report = await worker.runBatch(50);
    assert.equal(report.failed + report.scheduled + report.unconfirmed, 0);
    const marker = await client.send(
      new HeadObjectCommand({
        Bucket: 'private-article-covers',
        Key: articleCoverObjectKey(first.id),
      })
    );
    assert.equal(marker.ContentLength, 0);
    assert.equal(marker.Metadata['retired-image-id'], first.id);
    await assert.rejects(
      objects.putImmutable(uploaded.asset, approvedBytes),
      /immutable/
    );
    await json(409, 'PUT', route, {
      ...content,
      cover,
      expectedRevision: (await status()).revision,
    });
    await json(409, 'DELETE', 'me/article-covers/' + second.id, {
      expectedRevision: 2,
    });
    pass(
      'replaced covers retire through durable cleanup; empty private markers reject late writes and retired references cannot be reattached'
    );

    const reads = new ArticleCoverReads(
      new MysqlArticleCoverReads(source, 'default'),
      {
        putImmutable: objects.putImmutable.bind(objects),
        read: async (asset) => {
          const data = await objects.read(asset);
          await transition('withdraw');
          return data;
        },
      },
      policy
    );
    await assert.rejects(reads.published(id, second.id), /not found/);
    assert.equal((await projections.find('article', id)).deletedAt, null);
    assert.equal(
      (
        await request(
          'GET',
          'media/articles/' + id + '/' + second.id,
          undefined,
          null
        )
      ).status,
      404
    );
    assert.equal(
      (
        await request(
          'GET',
          'catalog/articles/' + content.slug,
          undefined,
          null
        )
      ).status,
      404
    );
    if (broker) {
      await transition('submit');
      await transition('approve', reviewer);
      await require('./article-publication-delivery.cjs').articlePublicationDelivery(
        {
          source,
          reader,
          projections,
          collection: broker.collection,
          port: broker.port,
          password: broker.password,
          id,
          withdraw: () => transition('withdraw'),
          pass,
        }
      );
    }
    await projections.publish(
      projectEditorialSnapshot(await reader.read('article', id))
    );
    assert.equal(await projections.publish(firstProjection), 'superseded');
    await json(200, 'DELETE', route, {
      expectedRevision: (await status()).revision,
    });
    await worker.runBatch(50);
    const retained = await client.send(
      new HeadObjectCommand({
        Bucket: 'private-article-covers',
        Key: articleCoverObjectKey(second.id),
      })
    );
    assert.ok(retained.ContentLength > 0);
    assert.equal(
      (await request('GET', 'me/article-covers/' + second.id + '/content'))
        .status,
      404
    );
    assert.equal(
      (
        await source.query(
          'SELECT kind FROM article_cover_references WHERE articleId = ?',
          [id]
        )
      ).length,
      1
    );
    pass(
      'withdrawal during object I/O withholds loaded bytes despite stale Mongo; tombstones defeat old snapshots and retained reviewed references survive private deletion'
    );

    for (let attempt = 0; attempt < 4; attempt++) {
      const raceDraft = await createDraft();
      const raceFields = await json(200, 'GET', 'me/articles/' + raceDraft.id);
      const reservation = await json(201, 'POST', 'me/article-covers', {
        articleId: raceDraft.id,
        source: descriptor(bytes),
      });
      await json(
        200,
        'PUT',
        'me/article-covers/' + reservation.id + '/content',
        bytes,
        owner,
        binary
      );
      const savedFields = {
        ...content,
        slug: raceFields.slug,
        cover: { imageId: reservation.id, alt: 'Concurrent retention cover' },
        expectedRevision: 1,
      };
      const [, response] = await Promise.all([
        cleanup.retireUnused(now, 50),
        request('PUT', 'me/articles/' + raceDraft.id, savedFields),
      ]);
      const saved = await response.json();
      assert.ok([200, 409].includes(response.status), JSON.stringify(saved));
      const [row] = await source.query(
        'SELECT status FROM article_cover_uploads WHERE id = ?',
        [reservation.id]
      );
      const references = await source.query(
        'SELECT imageId FROM article_cover_references WHERE imageId = ?',
        [reservation.id]
      );
      if (response.status === 200) {
        assert.equal(row.status, 'ready');
        assert.equal(references.length, 1);
      } else {
        assert.equal(row.status, 'cancelled');
        assert.equal(references.length, 0);
      }
    }
    await worker.runBatch(50);
    pass(
      'real concurrent attachment and retention converge: every referenced cover stays ready and every retired cover has no references'
    );

    const recoveryDraft = await createDraft();
    const recoveryCover = await json(201, 'POST', 'me/article-covers', {
      articleId: recoveryDraft.id,
      source: descriptor(bytes),
    });
    await json(200, 'DELETE', 'me/article-covers/' + recoveryCover.id, {
      expectedRevision: 1,
    });
    const failing = new ArticleCoverCleanup(
      cleanup,
      {
        retire: async () => {
          throw new Error('injected storage outage');
        },
      },
      () => now
    );
    for (let attempt = 0; attempt < 8; attempt++) {
      const failed = await failing.runBatch(1);
      assert.equal(failed.attempted, 1);
      now += 300001;
    }
    const failure = (await cleanup.status()).failures.find(
      (value) => value.imageId === recoveryCover.id
    );
    assert.ok(failure);
    assert.equal(failure.attempts, 8);
    assert.equal((await failing.runBatch(1)).attempted, 0);
    assert.equal(await cleanup.requeue(recoveryCover.id, now), true);
    const oldLease = await cleanup.claim(now);
    now += 30001;
    const newLease = await cleanup.claim(now);
    assert.equal(newLease.imageId, recoveryCover.id);
    assert.notEqual(newLease.token, oldLease.token);
    await objects.retire(recoveryCover.id);
    assert.equal(await cleanup.complete(oldLease, now), false);
    assert.equal(await cleanup.fail(oldLease, now), 'stale');
    assert.equal(await cleanup.complete(newLease, now), true);
    pass(
      'cleanup retries stop after eight failures; explicit requeue and lease takeover recover without stale completion or failure'
    );

    const migrations = [
      new ArticleWorkspace1791676818000(),
      new ArticleCovers1791676819000(),
      new ArticleCoverReferences1791676820000(),
      new ArticleCoverCleanup1791676821000(),
    ];
    for (const migration of migrations) await migration.up(runner);
    await source.query(
      "UPDATE article_cover_references SET kind = 'bad' WHERE articleId = ?",
      [id]
    );
    try {
      await assert.rejects(migrations[2].up(runner), /Invalid article cover/);
    } finally {
      await source.query(
        "UPDATE article_cover_references SET kind = 'publication' WHERE articleId = ?",
        [id]
      );
    }
    await source.query(
      'DELETE FROM article_cover_references WHERE articleId = ?',
      [id]
    );
    try {
      await assert.rejects(migrations[2].up(runner), /disagree/);
    } finally {
      await source.query(
        "INSERT INTO article_cover_references (articleId, kind, imageId) VALUES (?, 'publication', ?)",
        [id, second.id]
      );
    }
    for (const migration of migrations) {
      await migration.up(runner);
      await assert.rejects(migration.down(runner), /data-preserving/);
    }
    await restart();
    assert.equal(
      (
        await request(
          'GET',
          'media/articles/' + id + '/' + second.id,
          undefined,
          null
        )
      ).status,
      404
    );
    assert.equal((await request('GET', route)).status, 404);
    assert.ok(approval.publicationRevision);
    pass(
      'migration reentry checks cover descriptors, canonical references, leases and cleanup; incompatible reference authority fails closed and restart retains withdrawals'
    );
  } finally {
    await runner.release();
    objects.onModuleDestroy();
    client.destroy();
  }
}
module.exports = { articleCoverPublicationChecks };
