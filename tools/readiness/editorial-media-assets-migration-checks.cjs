const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const base = '../../apps/services/editorial/src/app/';
const { EditorialMediaAssets1791840011000 } = require(base +
  'application-media/editorial-media-assets.migration');
const { recordEditorialMediaAsset } = require(base +
  'application-media/editorial-media-assets');

module.exports = async function editorialMediaAssetsMigrationChecks({
  source: host,
  pass,
}) {
  assert.equal(host.options.database, 'suites');
  const database = 'wapps_media_assets_' + randomUUID().replaceAll('-', '');
  const prior = host.options.migrations.slice(
    0,
    host.options.migrations.indexOf(EditorialMediaAssets1791840011000)
  );
  assert.ok(prior.length > 10);
  const connect = (migrations) =>
    new DataSource({
      ...host.options,
      database,
      migrations,
      migrationsRun: false,
    }).initialize();
  await host.query(`CREATE DATABASE \`${database}\``);
  let source, runner;
  const migration = new EditorialMediaAssets1791840011000();
  const id = randomUUID(),
    articleId = randomUUID();
  const appIds = Array.from({ length: 130 }, () => randomUUID()).sort();
  const coverIds = Array.from({ length: 130 }, () => randomUUID()).sort();
  const asset = (imageId, kind) => ({
    id: imageId,
    ...(kind === 'application' ? { purpose: 'logo' } : {}),
    contentType: 'image/webp',
    bytes: 44,
    sha256: 'a'.repeat(64),
    width: 40,
    height: 20,
  });
  const insert = (table, row) =>
    source.query(
      `INSERT INTO ${table} (${Object.keys(row).join(
        ','
      )}) VALUES (${Object.keys(row)
        .map(() => '?')
        .join(',')})`,
      Object.values(row)
    );
  try {
    source = await connect(prior);
    await source.runMigrations();
    await insert('application_drafts', {
      id,
      tenantId: 'default',
      ownerIdentityId: 'LegacyUploader',
      name: 'Legacy media',
      slug: 'legacy-media',
      website: 'https://legacy.example.test',
      description: 'Legacy metadata.',
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    });
    for (const purpose of ['logo', 'banner'])
      await insert('application_draft_images', {
        draftId: id,
        purpose,
        imageId: purpose === 'logo' ? appIds[0] : null,
        url: null,
      });
    await insert('article_drafts', {
      id: articleId,
      tenantId: 'default',
      ownerIdentityId: 'LegacyUploader',
      fields: JSON.stringify({
        title: 'Legacy cover',
        slug: 'legacy-cover',
        excerpt: 'Legacy article.',
        byline: 'Legacy writer',
        category: 'Guides',
        tags: [],
        sections: [{ heading: 'Body', paragraphs: ['Legacy content.'] }],
        cover: { imageId: coverIds[0], alt: 'Legacy cover image' },
      }),
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    });
    await insert('article_cover_references', {
      articleId,
      kind: 'draft',
      imageId: coverIds[0],
    });
    const cancelled = [];
    for (const [kind, prefix, ids] of [
      ['application', 'application_image', appIds],
      ['article', 'article_cover', coverIds],
    ]) {
      const pendingId = randomUUID(),
        cancelledId = randomUUID();
      cancelled.push({ kind, imageId: cancelledId });
      for (const imageId of [...ids, pendingId, cancelledId]) {
        const status =
          imageId === pendingId
            ? 'pending'
            : imageId === cancelledId
            ? 'cancelled'
            : 'ready';
        await insert(prefix + '_uploads', {
          id: imageId,
          tenantId: 'default',
          ownerIdentityId: 'LegacyUploader',
          ...(kind === 'application'
            ? { draftId: id, purpose: 'logo' }
            : { articleId }),
          sourceType: 'image/png',
          sourceBytes: 100,
          sourceSha256: 'b'.repeat(64),
          revision: status === 'pending' ? 1 : 2,
          status,
          createdAt: 1,
          expiresAt: 86400001,
          asset:
            status === 'ready' ? JSON.stringify(asset(imageId, kind)) : null,
          attempts: 0,
          leaseToken: null,
          leaseUntil: null,
          commandKey: null,
        });
        if (status === 'cancelled')
          await insert(prefix + '_cleanup', {
            imageId,
            reason: 'cancelled',
            createdAt: 2,
            availableAt: 2,
            attempts: 0,
            leaseToken: null,
            leaseUntil: null,
            completedAt: null,
            failedAt: null,
            lastError: null,
          });
      }
    }
    runner = source.createQueryRunner();
    await source.query('UPDATE article_cover_uploads SET asset=? WHERE id=?', [
      JSON.stringify({ ...asset(coverIds[129], 'article'), sha256: 'corrupt' }),
      coverIds[129],
    ]);
    await assert.rejects(migration.up(runner), /invalid/);
    assert.equal(await runner.hasTable('editorial_media_assets'), false);
    await source.query('UPDATE article_cover_uploads SET asset=? WHERE id=?', [
      JSON.stringify(asset(coverIds[129], 'article')),
      coverIds[129],
    ]);
    await source.query(
      'DELETE FROM article_cover_references WHERE articleId=?',
      [articleId]
    );
    await assert.rejects(migration.up(runner), /disagree/);
    assert.equal(await runner.hasTable('editorial_media_assets'), false);
    await insert('article_cover_references', {
      articleId,
      kind: 'draft',
      imageId: coverIds[0],
    });
    const before = await source.query(
      'SELECT * FROM application_image_uploads ORDER BY id'
    );
    const query = runner.query.bind(runner);
    let inserted = 0;
    runner.query = async (sql, ...args) => {
      if (
        sql.startsWith('INSERT INTO editorial_media_assets') &&
        ++inserted === 130
      )
        throw new Error('Interrupted second descriptor page');
      return query(sql, ...args);
    };
    await assert.rejects(
      migration.up(runner),
      /Interrupted second descriptor page/
    );
    runner.query = query;
    assert.equal(
      Number(
        (await source.query('SELECT COUNT(*) n FROM editorial_media_assets'))[0]
          .n
      ),
      before.slice(0, 128).filter((row) => row.status !== 'pending').length
    );
    await runner.release();
    runner = null;
    await source.destroy();
    source = await connect([...prior, EditorialMediaAssets1791840011000]);
    await source.runMigrations();
    runner = source.createQueryRunner();
    await migration.up(runner);
    assert.equal(
      Number(
        (await source.query('SELECT COUNT(*) n FROM editorial_media_assets'))[0]
          .n
      ),
      262
    );
    assert.equal(
      Number(
        (await source.query('SELECT COUNT(*) n FROM editorial_outbox'))[0].n
      ),
      0
    );
    assert.deepEqual(
      await source.query('SELECT * FROM application_image_uploads ORDER BY id'),
      before
    );
    for (const record of cancelled) {
      const [row] = await source.query(
        'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=?',
        [record.kind, record.imageId]
      );
      assert.equal(row.asset, null);
      assert.equal(Number(row.retiredAt), 2);
      await assert.rejects(
        source.transaction((manager) =>
          recordEditorialMediaAsset(manager, {
            ...row,
            createdAt: Number(row.createdAt),
            retiredAt: null,
            asset: asset(row.imageId, row.kind),
          })
        ),
        /conflicts/
      );
    }
    pass(
      'legacy migration validates both upload families beyond 128 rows and missing cover references before DDL; an interrupted second page rolls back, restart resumes 262 exact descriptors/tombstones without source/event changes, and retired keys cannot be revived'
    );

    await source.query(
      'RENAME TABLE editorial_media_assets TO saved_media_assets'
    );
    await assert.rejects(migration.up(runner), /Applied.*schema is missing/);
    await source.query(
      'RENAME TABLE saved_media_assets TO editorial_media_assets'
    );
    await source.query(
      'DROP INDEX idx_editorial_media_retirement ON editorial_media_assets'
    );
    await assert.rejects(migration.up(runner), /Incompatible.*schema/);
    await source.query(
      'CREATE INDEX idx_editorial_media_retirement ON editorial_media_assets (kind,retiredAt,createdAt,imageId(10))'
    );
    await assert.rejects(migration.up(runner), /Incompatible.*index/);
    await source.query(
      'DROP INDEX idx_editorial_media_retirement ON editorial_media_assets'
    );
    await source.query(
      'CREATE INDEX idx_editorial_media_retirement ON editorial_media_assets (kind,retiredAt,createdAt,imageId)'
    );
    const [saved] = await source.query(
      "SELECT * FROM editorial_media_assets WHERE kind='application' AND imageId=?",
      [appIds[0]]
    );
    await source.query(
      "DELETE FROM editorial_media_assets WHERE kind='application' AND imageId=?",
      [appIds[0]]
    );
    await assert.rejects(
      migration.up(runner),
      /Applied.*descriptor is missing/
    );
    await insert('editorial_media_assets', {
      ...saved,
      asset:
        typeof saved.asset === 'string'
          ? saved.asset
          : JSON.stringify(saved.asset),
    });
    await source.query(
      "UPDATE application_draft_images SET imageId=? WHERE draftId=? AND purpose='logo'",
      [cancelled[0].imageId, id]
    );
    await assert.rejects(migration.up(runner), /unavailable asset/);
    await source.query(
      "UPDATE application_draft_images SET imageId=? WHERE draftId=? AND purpose='logo'",
      [appIds[0], id]
    );
    await source.query(
      "UPDATE editorial_media_assets SET retiredAt=3 WHERE kind='application' AND imageId=?",
      [cancelled[0].imageId]
    );
    await assert.rejects(migration.up(runner), /differs from upload/);
    await source.query(
      "UPDATE editorial_media_assets SET retiredAt=2 WHERE kind='application' AND imageId=?",
      [cancelled[0].imageId]
    );
    await migration.up(runner);
    await assert.rejects(migration.down(runner), /data-preserving/);
    pass(
      'applied media schema/table/index-prefix/descriptor loss, retired references and inconsistent retirement timestamps fail closed; repaired reentry succeeds and destructive rollback is refused'
    );
  } finally {
    await runner?.release();
    if (source?.isInitialized) await source.destroy();
    await host.query(`DROP DATABASE \`${database}\``);
  }
};
