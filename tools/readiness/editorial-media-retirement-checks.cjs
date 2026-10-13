const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const {
  parseApplicationImageAsset,
  parseArticleCoverAsset,
} = require('../../libs/domains/catalog/media/src');
const base = '../../apps/services/editorial/src/app/';
const { recordEditorialMediaAsset } = require(base +
  'application-media/editorial-media-assets');
const { saveDraftApplicationImages } = require(base +
  'application-media/application-image-bindings');
const { ApplicationImageCleanup } = require(base +
  'application-media/application-image-cleanup');
const { MysqlApplicationImageCleanup } = require(base +
  'application-media/mysql-application-image-cleanup');
const { MysqlArticleCoverCleanup } = require(base +
  'article-covers/mysql-article-cover-cleanup');
const { ApplicationImageCleanup1791676816000 } = require(base +
  'application-media/application-image-cleanup.migration');
const { ArticleCoverCleanup1791676821000 } = require(base +
  'article-covers/article-cover-cleanup.migration');
const { EditorialMediaAssets1791840011000 } = require(base +
  'application-media/editorial-media-assets.migration');
const { S3ApplicationImages, applicationImageObjectKey } = require(base +
  'application-media/s3-application-images');
const { articleCoverObjectKey } = require(base +
  'article-covers/article-cover-storage');
const lifetime = 7 * 24 * 60 * 60 * 1000;

module.exports = async function editorialMediaRetirementChecks({
  source,
  storage,
  retained,
  restart,
  maintenance,
  pass,
}) {
  assert.equal(source.options.database, 'suites');
  const client = new S3Client(storage);
  let now = Date.now();
  const families = [
    {
      kind: 'application',
      prefix: 'application_image',
      Store: MysqlApplicationImageCleanup,
      key: applicationImageObjectKey,
      sample: retained.logo,
    },
    {
      kind: 'article',
      prefix: 'article_cover',
      Store: MysqlArticleCoverCleanup,
      key: articleCoverObjectKey,
      sample: retained.cover,
    },
  ];
  const row = async (family, id) =>
    (
      await source.query(
        'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=?',
        [family.kind, id]
      )
    )[0];
  const job = async (family, id) =>
    (
      await source.query(
        `SELECT * FROM ${family.prefix}_cleanup WHERE imageId=?`,
        [id]
      )
    )[0];
  const descriptor = (sample) => {
    const value =
      typeof sample.descriptor.asset === 'string'
        ? JSON.parse(sample.descriptor.asset)
        : sample.descriptor.asset;
    return sample.descriptor.kind === 'application'
      ? parseApplicationImageAsset(value)
      : parseArticleCoverAsset(value);
  };
  const objects = (family) =>
    new S3ApplicationImages(client, 'retained-media', family.key);
  async function create(
    family,
    tenantId = 'default',
    createdAt = now - lifetime - 1
  ) {
    const id = randomUUID();
    const asset = { ...descriptor(family.sample), id };
    await objects(family).putImmutable(
      { ...asset, purpose: family.kind === 'application' ? 'logo' : 'banner' },
      family.sample.bytes
    );
    const record = {
      kind: family.kind,
      imageId: id,
      tenantId,
      articleId: family.kind === 'article' ? retained.articleId : null,
      asset,
      createdAt,
      retiredAt: null,
    };
    await source.transaction((manager) =>
      recordEditorialMediaAsset(manager, record)
    );
    return record;
  }
  async function marker(family, id, retired) {
    const object = await client.send(
      new HeadObjectCommand({ Bucket: 'retained-media', Key: family.key(id) })
    );
    assert.equal(
      object.ContentLength,
      retired ? 0 : family.sample.bytes.length
    );
    if (retired) {
      assert.equal(object.ContentType, 'application/x-wapps-retired-image');
      assert.equal(object.Metadata['retired-image-id'], id);
    }
  }
  const originalImages = {
    logo: { kind: 'upload', asset: descriptor(retained.logo) },
    banner: null,
  };
  try {
    for (const family of families) {
      const store = new family.Store(source);
      assert.equal(
        await store.retireUnused(now + lifetime, 50),
        0,
        'public and inherited references survive without private upload rows'
      );
      const a = await create(family),
        b = await create(family, 'other');
      await source.query(
        `CREATE TRIGGER qualification_retirement_failure BEFORE INSERT ON ${family.prefix}_cleanup FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected cleanup intent failure'`
      );
      try {
        await assert.rejects(
          store.retireUnused(now, 1),
          /Injected cleanup intent failure/
        );
      } finally {
        await source.query('DROP TRIGGER qualification_retirement_failure');
      }
      for (const record of [a, b]) {
        assert.equal((await row(family, record.imageId)).retiredAt, null);
        assert.equal(await job(family, record.imageId), undefined);
        await marker(family, record.imageId, false);
      }
      assert.equal(await store.retireUnused(now, 1), 1);
      assert.equal(
        [await row(family, a.imageId), await row(family, b.imageId)].filter(
          (record) => record.retiredAt !== null
        ).length,
        1
      );
      assert.equal(await store.retireUnused(now, 1), 1);
      assert.equal(await store.retireUnused(now, 1), 0);
      const lease = await store.claim(now);
      assert.ok(lease);
      // A process can die after the object marker is durable but before SQL completion.
      await objects(family).retire(lease.imageId);
      await marker(family, lease.imageId, true);
      await restart();
      now = Math.max(now + 30001, Date.now());
      const recovered = new family.Store(source);
      const takeover = await recovered.claim(now);
      assert.ok(takeover);
      assert.equal(takeover.imageId, lease.imageId);
      assert.notEqual(takeover.token, lease.token);
      assert.equal(await store.complete(lease, now), false);
      assert.equal(await store.fail(lease, now), 'stale');
      await objects(family).retire(takeover.imageId);
      assert.equal(await recovered.complete(takeover, now), true);
      const cleanup = new ApplicationImageCleanup(
        recovered,
        objects(family),
        () => now
      );
      await source.query(
        `CREATE TRIGGER qualification_completion_failure BEFORE UPDATE ON ${family.prefix}_cleanup FOR EACH ROW BEGIN IF NEW.completedAt IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected cleanup completion failure'; END IF; END`
      );
      try {
        const report = await cleanup.runBatch(1);
        assert.equal(report.attempted, 1);
        assert.equal(report.completed, 0);
        assert.equal(report.scheduled, 1);
      } finally {
        await source.query('DROP TRIGGER qualification_completion_failure');
      }
      now += 1001;
      const report = await cleanup.runBatch(1);
      assert.equal(report.completed, 1);
      for (const record of [a, b]) {
        const current = await row(family, record.imageId);
        assert.equal(current.asset, null);
        assert.ok((await job(family, record.imageId)).completedAt);
        await marker(family, record.imageId, true);
        await assert.rejects(
          source.transaction((manager) =>
            recordEditorialMediaAsset(manager, record)
          ),
          /conflicts/
        );
        await assert.rejects(
          objects(family).putImmutable(
            {
              ...record.asset,
              purpose: family.kind === 'application' ? 'logo' : 'banner',
            },
            family.sample.bytes
          )
        );
      }
      pass(
        `${family.kind}: registry-only orphan retirement respects batch bounds and tenant-scoped references; cleanup-intent failure rolls back; real object-success/process-loss/SQL-failure recover with fenced leases and permanent non-reviving markers`
      );
      const recent = await create(family, 'default', now - lifetime + 100);
      assert.equal(await recovered.retireUnused(now, 50), 0);
      await marker(family, recent.imageId, false);
      now += 100;
      assert.equal(await recovered.retireUnused(now, 50), 1);
      assert.equal((await cleanup.runBatch(1)).completed, 1);
      await marker(family, recent.imageId, true);
    }

    const app = families[0];
    const racing = await create(app);
    const writer = source.createQueryRunner();
    await writer.startTransaction('READ COMMITTED');
    let reached;
    const waiting = new Promise((resolve) => {
      reached = resolve;
    });
    const observed = {
      query: source.query.bind(source),
      transaction: (isolation, run) =>
        source.transaction(isolation, (manager) =>
          run(
            new Proxy(manager, {
              get(target, property) {
                if (property !== 'query') return Reflect.get(target, property);
                return (sql, values) => {
                  if (
                    sql.startsWith('SELECT * FROM editorial_media_assets') &&
                    values.includes(racing.imageId)
                  )
                    reached();
                  return target.query(sql, values);
                };
              },
            })
          )
        ),
    };
    let cleanup;
    try {
      await saveDraftApplicationImages(
        writer.manager,
        retained.draftId,
        { logo: { kind: 'upload', asset: racing.asset }, banner: null },
        'default'
      );
      cleanup = new MysqlApplicationImageCleanup(observed).retireUnused(now, 1);
      await Promise.race([
        waiting,
        new Promise((_, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                new Error('Retirement did not reach the held descriptor lock')
              ),
            5000
          );
          timer.unref();
        }),
      ]);
      await writer.commitTransaction();
      assert.equal(await cleanup, 0);
      assert.equal((await row(app, racing.imageId)).retiredAt, null);
      await marker(app, racing.imageId, false);
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release();
      if (cleanup) await cleanup;
    }
    await source.transaction((manager) =>
      saveDraftApplicationImages(
        manager,
        retained.draftId,
        originalImages,
        'default'
      )
    );
    assert.equal(
      await new MysqlApplicationImageCleanup(source).retireUnused(now, 1),
      1
    );
    await assert.rejects(
      source.transaction((manager) =>
        saveDraftApplicationImages(
          manager,
          retained.draftId,
          { logo: { kind: 'upload', asset: racing.asset }, banner: null },
          'default'
        )
      ),
      /no longer available/
    );
    pass(
      'deterministic inherited-reference race waits on the registry lock and preserves a committed reference; after its last reference is released, retirement fences a stale in-flight descriptor'
    );

    const store = new MysqlApplicationImageCleanup(source);
    await source.query(
      "UPDATE application_draft_images SET imageId=? WHERE draftId=? AND purpose='logo'",
      [racing.imageId, retained.draftId]
    );
    assert.equal(await store.claim(now), null);
    assert.equal(
      (await job(app, racing.imageId)).lastError,
      'canonical-reference-conflict'
    );
    await marker(app, racing.imageId, false);
    await source.transaction((manager) =>
      saveDraftApplicationImages(
        manager,
        retained.draftId,
        originalImages,
        'default'
      )
    );
    assert.equal(await store.requeue(racing.imageId, now), true);
    assert.equal(
      (
        await new ApplicationImageCleanup(
          store,
          objects(app),
          () => now
        ).runBatch(1)
      ).completed,
      1
    );
    await marker(app, racing.imageId, true);

    const missing = await create(app);
    await store.retireUnused(now, 1);
    const guard = await row(app, missing.imageId);
    await source.query(
      "DELETE FROM editorial_media_assets WHERE kind='application' AND imageId=?",
      [missing.imageId]
    );
    assert.equal(await store.claim(now), null);
    assert.equal(
      (await job(app, missing.imageId)).lastError,
      'canonical-reference-conflict'
    );
    await marker(app, missing.imageId, false);
    await source.transaction((manager) =>
      recordEditorialMediaAsset(manager, {
        ...guard,
        createdAt: Number(guard.createdAt),
        retiredAt: Number(guard.retiredAt),
      })
    );
    await store.requeue(missing.imageId, now);
    await new ApplicationImageCleanup(store, objects(app), () => now).runBatch(
      1
    );
    pass(
      'a corrupt reference or missing registry guard quarantines cleanup before object I/O; restoring exact authority and explicit requeue recover without recreating private history'
    );

    const runner = source.createQueryRunner();
    try {
      for (const Migration of [
        EditorialMediaAssets1791840011000,
        ApplicationImageCleanup1791676816000,
        ArticleCoverCleanup1791676821000,
      ])
        await new Migration().up(runner);
      await source.query(
        "UPDATE editorial_media_assets SET retiredAt=retiredAt+1 WHERE kind='application' AND imageId=?",
        [missing.imageId]
      );
      await assert.rejects(
        new ApplicationImageCleanup1791676816000().up(runner),
        /Invalid image retirement/
      );
      await source.query(
        "UPDATE editorial_media_assets SET retiredAt=retiredAt-1 WHERE kind='application' AND imageId=?",
        [missing.imageId]
      );
      await new ApplicationImageCleanup1791676816000().up(runner);
    } finally {
      await runner.release();
    }
    for (const family of families) {
      const runtime = await create(
        family,
        'default',
        Date.now() - lifetime - 1
      );
      const result = maintenance([
        family.kind === 'application'
          ? '--media-cleanup'
          : '--article-cover-cleanup',
      ]);
      const report = JSON.parse(
        result
          .trim()
          .split('\n')
          .findLast((line) => line.startsWith('{'))
      );
      assert.equal(report.completed, 1);
      assert.equal(report.failed + report.scheduled + report.unconfirmed, 0);
      await marker(family, runtime.imageId, true);
      assert.ok((await job(family, runtime.imageId)).completedAt);
    }
    await restart();
    pass(
      'migration reentry accepts registry-only completed guards and rejects retirement mismatch; both compiled maintenance commands reclaim real orphan bytes and durable completion survives API restart'
    );
  } finally {
    client.destroy();
  }
};
