const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const sharp = require('sharp');
const {
  S3Client,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

async function articleCoverUploadChecks({
  root,
  source,
  policy,
  pass,
  objects: configuration,
  stopPolicy,
  qualifyHttp,
}) {
  const load = (name) =>
    require(path.join(root, 'apps/services/editorial/src/app', name));
  const { ArticleCovers } = load('article-covers/article-covers');
  const { MysqlArticleCovers, ARTICLE_COVER_LEASE_MS } = load(
    'article-covers/mysql-article-covers'
  );
  const { SharpApplicationImages } = load(
    'application-media/sharp-application-images'
  );
  const {
    ArticleCoverNormalizerAdapter,
    ConfiguredArticleCoverObjects,
    articleCoverObjectKey,
  } = load('article-covers/article-cover-storage');
  const { ConfigService } = require('@nestjs/config');
  const { ArticleCovers1791676819000 } = load(
    'article-covers/article-covers.migration'
  );
  const { ArticleWorkspace } = load('articles/article-workspace');
  const { MysqlArticleWorkspace } = load('articles/mysql-article-workspace');
  const client = new S3Client({
    region: 'us-east-1',
    endpoint: configuration.endpoint,
    forcePathStyle: true,
    maxAttempts: 2,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
  const bucket = 'private-article-covers';
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  const objects = new ConfiguredArticleCoverObjects(
    new ConfigService({
      EDITORIAL_MEDIA_ENDPOINT: configuration.endpoint,
      EDITORIAL_MEDIA_BUCKET: bucket,
      EDITORIAL_MEDIA_ACCESS_KEY: configuration.accessKeyId,
      EDITORIAL_MEDIA_SECRET_KEY: configuration.secretAccessKey,
    })
  );
  const store = new MysqlArticleCovers(source);
  let now = Date.now();
  const actor = { identityId: 'MediaAlice', tenantId: 'default', roles: [] };
  const normalizer = new ArticleCoverNormalizerAdapter(
    new SharpApplicationImages()
  );
  const images = new ArticleCovers(
    store,
    normalizer,
    objects,
    policy,
    { generate: randomUUID },
    () => now
  );
  const drafts = new ArticleWorkspace(
    new MysqlArticleWorkspace(source),
    policy,
    { generate: randomUUID },
    () => now
  );
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const bytes = await sharp({
    create: {
      width: 120,
      height: 60,
      channels: 4,
      background: { r: 10, g: 40, b: 90, alpha: 0.7 },
    },
  })
    .withMetadata({ exif: { IFD0: { Artist: 'Private EXIF' } } })
    .png()
    .toBuffer();
  const sourceDescriptor = {
    contentType: 'image/png',
    bytes: bytes.length,
    sha256: digest(bytes),
  };
  const createDraft = (owner = actor) =>
    drafts.change(
      owner,
      'create',
      null,
      {
        title: 'Cover qualification',
        slug: 'media-' + randomUUID(),
        excerpt: 'Private upload qualification.',
        byline: 'Public writer',
        category: 'Guides',
        tags: [],
        sections: [{ heading: '', paragraphs: ['Article cover test.'] }],
      },
      randomUUID()
    );
  const draft = await createDraft();
  const input = {
    articleId: draft.id,
    source: sourceDescriptor,
  };
  const reserve = (value = input, owner = actor, key = randomUUID()) =>
    images.create(owner, value, key);
  const command = (id, key = randomUUID(), owner = actor, at = now) => ({
    actor: owner,
    id,
    key,
    at,
    expectedRevision: 1,
    sourceSha256: sourceDescriptor.sha256,
    sourceBytes: bytes.length,
    fingerprint: digest(
      JSON.stringify({
        action: 'upload',
        id,
        expectedRevision: 1,
        sourceSha256: sourceDescriptor.sha256,
        sourceBytes: bytes.length,
      })
    ),
  });
  const normalized = await normalizer.normalize(bytes, 'image/png');
  const descriptor = (id) => ({
    id,
    contentType: 'image/webp',
    bytes: normalized.bytes.length,
    sha256: digest(normalized.bytes),
    width: normalized.width,
    height: normalized.height,
  });
  const count = async (table) =>
    Number(
      (await source.query(`SELECT COUNT(*) AS total FROM ${table}`))[0].total
    );
  const outbox = await count('editorial_outbox');
  const migration = new ArticleCovers1791676819000();
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    const key = randomUUID();
    const [first, second] = await Promise.all([
      reserve(input, actor, key),
      reserve(input, actor, key),
    ]);
    assert.deepEqual(first, second);
    assert.equal(await count('article_cover_uploads'), 1);
    await assert.rejects(
      reserve(
        { ...input, source: { ...sourceDescriptor, bytes: bytes.length + 1 } },
        actor,
        key
      ),
      /another command/
    );
    for (const owner of [
      { ...actor, identityId: 'MediaBob' },
      { ...actor, identityId: 'mediaalice' },
      { ...actor, tenantId: 'other' },
      { ...actor, identityId: 'Admin', roles: ['admin'] },
    ]) {
      await assert.rejects(images.read(owner, first.id), /not found/);
      await assert.rejects(reserve(input, owner), /not found/);
      await assert.rejects(
        images.upload(
          owner,
          first.id,
          { expectedRevision: 1 },
          bytes,
          randomUUID()
        ),
        /not found/
      );
    }
    pass(
      'concurrent create replay converges; SQL enforces case-sensitive owner/tenant isolation even for administrators'
    );

    const intent = command(first.id);
    const competing = await Promise.allSettled([
      store.reserve(intent),
      store.reserve(intent),
    ]);
    assert.equal(
      competing.filter((item) => item.status === 'fulfilled').length,
      1
    );
    assert.equal(
      competing.filter((item) => item.status === 'rejected').length,
      1
    );
    const lease1 = competing.find((item) => item.status === 'fulfilled').value;
    await assert.rejects(
      store.reserve({ ...intent, key: randomUUID() }),
      /processing/
    );
    now += ARTICLE_COVER_LEASE_MS;
    const retry = { ...intent, at: now };
    const lease2 = await new MysqlArticleCovers(source).reserve(retry);
    assert.notEqual(lease1.lease, lease2.lease);
    await objects.putImmutable(descriptor(first.id), normalized.bytes);
    await assert.rejects(
      store.complete(intent, lease1.lease, descriptor(first.id), now),
      /lease expired/
    );
    await store.fail(intent, lease1.lease, now);
    const done = await store.complete(
      retry,
      lease2.lease,
      descriptor(first.id),
      now
    );
    assert.deepEqual(
      await images.upload(
        actor,
        first.id,
        { expectedRevision: 1 },
        bytes,
        intent.key
      ),
      done
    );
    assert.equal((await images.read(actor, first.id)).status, 'ready');
    const publicRead = await fetch(
      `${configuration.endpoint}/${bucket}/${articleCoverObjectKey(first.id)}`
    );
    assert.equal(publicRead.status, 403);
    assert.equal(await count('editorial_outbox'), outbox);
    pass(
      'lease takeover fences stale completion/failure; lost-response replay is durable; ready bytes remain private without public intent'
    );

    const interrupted = await reserve();
    const attempt = command(interrupted.id);
    const held = await store.reserve(attempt);
    await objects.putImmutable(descriptor(interrupted.id), normalized.bytes);
    await source.query(
      "CREATE TRIGGER reject_media_receipt BEFORE UPDATE ON article_cover_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification receipt failure'"
    );
    try {
      await assert.rejects(
        store.complete(attempt, held.lease, descriptor(interrupted.id), now),
        /Could not confirm/
      );
      assert.equal(
        (await images.read(actor, interrupted.id)).status,
        'pending'
      );
    } finally {
      await source.query('DROP TRIGGER reject_media_receipt');
    }
    now += ARTICLE_COVER_LEASE_MS;
    assert.equal(
      (
        await images.upload(
          actor,
          interrupted.id,
          { expectedRevision: 1 },
          bytes,
          attempt.key
        )
      ).status,
      'ready'
    );
    const ready = await images.read(actor, interrupted.id);
    const stored = await objects.read(ready.asset);
    assert.equal(digest(stored), ready.asset.sha256);
    const metadata = await sharp(stored).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    await assert.rejects(
      objects.putImmutable(
        { ...ready.asset, sha256: digest(Buffer.from('changed')), bytes: 7 },
        Buffer.from('changed')
      ),
      /immutable/
    );
    assert.equal(digest(await objects.read(ready.asset)), ready.asset.sha256);
    pass(
      'receipt failure rolls back readiness; retry recovers an already-written immutable MinIO object and strips source metadata'
    );

    const unavailable = await reserve();
    const unavailableKey = randomUUID();
    const offline = new ArticleCovers(
      store,
      normalizer,
      {
        putImmutable: async () => {
          throw new Error('injected object outage');
        },
        read: objects.read.bind(objects),
      },
      policy,
      { generate: randomUUID },
      () => now
    );
    await assert.rejects(
      offline.upload(
        actor,
        unavailable.id,
        { expectedRevision: 1 },
        bytes,
        unavailableKey
      ),
      /outage/
    );
    assert.equal((await images.read(actor, unavailable.id)).status, 'pending');
    assert.equal(
      (
        await images.upload(
          actor,
          unavailable.id,
          { expectedRevision: 1 },
          bytes,
          unavailableKey
        )
      ).status,
      'ready'
    );
    const bounded = await reserve();
    const boundedIntent = command(bounded.id);
    for (let i = 0; i < 3; i++) {
      const lease = await store.reserve(boundedIntent);
      await store.fail(boundedIntent, lease.lease, now);
    }
    await assert.rejects(store.reserve(boundedIntent), /retry limit/);
    for (let i = 0; i < 7; i++) {
      const newIntent = command(bounded.id);
      const lease = await store.reserve(newIntent);
      await store.fail(newIntent, lease.lease, now);
    }
    await assert.rejects(store.reserve(command(bounded.id)), /retry limit/);
    pass(
      'object outage releases only the current lease; same-key recovery succeeds and persistent retry limits survive adapter recreation'
    );

    const wrongSource = await reserve();
    await assert.rejects(
      images.upload(
        actor,
        wrongSource.id,
        { expectedRevision: 1 },
        Buffer.from('different'),
        randomUUID()
      ),
      /exact file/
    );
    assert.equal(
      (
        await source.query(
          'SELECT attempts FROM article_cover_uploads WHERE id = ?',
          [wrongSource.id]
        )
      )[0].attempts,
      0
    );
    const mismatch = command(wrongSource.id);
    const mismatchLease = await store.reserve(mismatch);
    await assert.rejects(
      store.complete(
        mismatch,
        mismatchLease.lease,
        { ...descriptor(wrongSource.id), id: randomUUID() },
        now
      ),
      /reservation/
    );
    await store.fail(mismatch, mismatchLease.lease, now);
    const deletedDraft = await createDraft();
    const deletedImage = await reserve({
      ...input,
      articleId: deletedDraft.id,
    });
    const deleting = command(deletedImage.id);
    const deletingLease = await store.reserve(deleting);
    await drafts.change(
      actor,
      'delete',
      deletedDraft.id,
      { expectedRevision: 1 },
      randomUUID()
    );
    await assert.rejects(
      store.complete(
        deleting,
        deletingLease.lease,
        descriptor(deletedImage.id),
        now
      ),
      /not found/
    );
    await assert.rejects(images.read(actor, deletedImage.id), /not found/);
    pass(
      'wrong source consumes no attempt; wrong-identity completion and concurrent draft deletion cannot create a ready asset'
    );

    const limitedActor = { ...actor, identityId: 'MediaCapacity' };
    const limitedDraft = await createDraft(limitedActor);
    const limitedInput = { ...input, articleId: limitedDraft.id };
    for (let i = 0; i < 19; i++) await reserve(limitedInput, limitedActor);
    const last = await Promise.allSettled([
      reserve(limitedInput, limitedActor),
      reserve(limitedInput, limitedActor),
    ]);
    assert.equal(
      last.filter((value) => value.status === 'fulfilled').length,
      1
    );
    assert.equal(last.filter((value) => value.status === 'rejected').length, 1);
    now += 24 * 60 * 60 * 1000;
    await assert.rejects(
      images.upload(
        actor,
        wrongSource.id,
        { expectedRevision: 1 },
        bytes,
        randomUUID()
      ),
      /expired/
    );
    await reserve(limitedInput, limitedActor);
    pass(
      'pending capacity races serialize; expired reservations refuse content and stop consuming pending capacity'
    );

    await migration.up(runner);
    await source.query(
      "UPDATE article_cover_uploads SET leaseToken = 'invalid' WHERE id = ?",
      [wrongSource.id]
    );
    await assert.rejects(migration.up(runner), /lease/);
    await source.query(
      'UPDATE article_cover_uploads SET leaseToken = NULL WHERE id = ?',
      [wrongSource.id]
    );
    await source.query(
      "UPDATE article_cover_commands SET receipt = JSON_SET(receipt, '$.id', ?) WHERE imageId = ? AND receipt IS NOT NULL",
      [randomUUID(), first.id]
    );
    await assert.rejects(migration.up(runner), /receipt/);
    // Repair only the deliberately corrupted disposable rows and verify safe reentry again.
    await source.query(
      "UPDATE article_cover_commands SET receipt = JSON_SET(receipt, '$.id', imageId) WHERE imageId = ? AND receipt IS NOT NULL",
      [first.id]
    );
    await migration.up(runner);
    await assert.rejects(migration.down(runner), /data-preserving/);
    pass(
      'additive migration reentry validates stored descriptors, leases, receipts and ownership relations; destructive rollback is refused'
    );

    const corrupt = await reserve();
    const corruption = descriptor(corrupt.id);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: articleCoverObjectKey(corrupt.id),
        Body: Buffer.alloc(corruption.bytes),
        ContentType: 'image/webp',
      })
    );
    await assert.rejects(objects.read(corruption), /immutable/);
    await assert.rejects(
      images.upload(
        actor,
        corrupt.id,
        { expectedRevision: 1 },
        bytes,
        randomUUID()
      ),
      /immutable/
    );
    assert.equal((await images.read(actor, corrupt.id)).status, 'pending');
    const existing = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: articleCoverObjectKey(corrupt.id),
      })
    );
    assert.deepEqual(
      Buffer.from(await existing.Body.transformToByteArray()),
      Buffer.alloc(corruption.bytes)
    );
    pass(
      'pre-existing corrupt or mismatched immutable bytes are detected and never overwritten or marked ready'
    );

    if (qualifyHttp) await qualifyHttp();
    const before = await count('article_cover_uploads');
    await stopPolicy();
    await assert.rejects(reserve(), /authorization unavailable/);
    assert.equal(await count('article_cover_uploads'), before);
    pass('real OPA outage fails closed before reserving image storage');
  } finally {
    await runner.release();
    objects.onModuleDestroy();
    client.destroy();
  }
}
module.exports = { articleCoverUploadChecks };
