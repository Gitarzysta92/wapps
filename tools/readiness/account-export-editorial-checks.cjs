const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const sharp = require('sharp');
const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const base = '../../apps/services/editorial/src/app/';
const { recordEditorialMediaAsset } = require(base +
  'application-media/editorial-media-assets');
const { MysqlEditorialAccountExportSource } = require(base +
  'account-export/mysql-editorial-account-export-source');
const { S3ApplicationImages, applicationImageObjectKey } = require(base +
  'application-media/s3-application-images');
const { articleCoverObjectKey } = require(base +
  'article-covers/article-cover-storage');
const { retireArticleCover } = require(base +
  'article-covers/article-cover-retirement');
const { recordApplicationOwnershipHistory } = require(base +
  'account-erasure/editorial-audit-erasure-schema');
const {
  APPLICATION_IMAGE_UPLOAD_LIFETIME,
} = require('../../libs/domains/catalog/media/src');
const signal = () => new AbortController().signal;
const collect = async (stream) => {
  const result = [];
  for await (const entry of stream) result.push(entry);
  return result;
};
const data = (rows, collection) =>
  rows
    .filter((row) => row.type === 'record' && row.collection === collection)
    .map((row) => row.data);

async function qualifyEditorialAccountExport({
  source,
  endpoint,
  password,
  exportSecret,
  restart,
  origin,
  stopPolicy,
  qualifyArchive,
  pass,
}) {
  const owner = 'EditorialExportOwner',
    tenantId = 'default',
    foreign = 'EditorialExportForeign';
  const at = Date.parse('2026-10-12T00:00:00Z');
  const appId = randomUUID(),
    oldAppId = randomUUID(),
    suiteId = randomUUID(),
    removedSuiteId = randomUUID();
  const articleId = randomUUID(),
    releaseId = randomUUID(),
    releaseDraftId = randomUUID(),
    claimId = randomUUID();
  const imageId = randomUUID(),
    coverId = randomUUID(),
    retiredCoverId = randomUUID();
  const insert = (table, row) =>
    source.query(
      `INSERT INTO ${table} (${Object.keys(row).join(
        ','
      )}) VALUES (${Object.keys(row)
        .map(() => '?')
        .join(',')})`,
      Object.values(row)
    );
  const state = (kind, id, extra = {}) =>
    insert('editorial_resource_states', {
      resourceKind: kind,
      resourceId: id,
      tenantId,
      ownerIdentityId: owner,
      revision: 1,
      deletedAt: null,
      ...extra,
    });
  const metadata = {
    tenantId,
    ownerIdentityId: owner,
    revision: 3,
    createdAt: at,
    updatedAt: at + 20,
    deletedAt: null,
  };
  const appFields = {
    name: 'Current private application',
    slug: 'export-application',
    website: 'https://example.com',
    description: 'Private application description',
  };
  await insert('application_drafts', { id: appId, ...metadata, ...appFields });
  await insert('application_submissions', {
    applicationId: appId,
    submittedRevision: 1,
    tenantId,
    ownerIdentityId: owner,
    ...appFields,
    name: 'Reviewed application',
    basePublicationRevision: null,
    status: 'approved',
    reason: '',
    submittedAt: at + 1,
    reviewedAt: at + 10,
    reviewerIdentityId: 'StaffIdentityExcluded',
  });
  await insert('application_publications', {
    applicationId: appId,
    submittedRevision: 1,
    publicationRevision: 1,
    publishedAt: at + 10,
  });
  await insert('app_records', {
    id: appId,
    ...appFields,
    name: 'Reviewed application',
    createdAt: '2026-10-12 00:00:00.123456',
    updatedAt: '2026-10-12 00:00:01.654321',
  });
  await state('app', appId, { revision: 2 });
  const removedAppId = randomUUID();
  await insert('application_drafts', {
    id: removedAppId,
    ...metadata,
    name: '',
    slug: '',
    website: '',
    description: '',
    deletedAt: metadata.updatedAt,
  });
  await insert('app_records', {
    id: removedAppId,
    name: '',
    slug: 'scrubbed-export-app',
    website: null,
    description: null,
    logoUrl: null,
    bannerUrl: null,
  });
  await state('app', removedAppId, { deletedAt: metadata.updatedAt });
  // Former owners retain their own private history but cannot export the new owner's state/content.
  await insert('application_drafts', {
    id: oldAppId,
    ...metadata,
    ...appFields,
    slug: 'former-application',
    name: 'My former application draft',
  });
  await insert('app_records', {
    id: oldAppId,
    name: 'Foreign canonical content excluded',
    slug: 'foreign-canonical',
  });
  await state('app', oldAppId, { ownerIdentityId: foreign });
  await insert('application_editing_targets', {
    draftId: oldAppId,
    applicationId: oldAppId,
    claimId,
    sourcePublicationRevision: 1,
  });
  await insert('application_drafts', {
    id: randomUUID(),
    ...metadata,
    ...appFields,
    slug: 'foreign-draft',
    ownerIdentityId: foreign,
    description: 'Foreign private draft excluded',
  });
  await insert('application_drafts', {
    id: randomUUID(),
    ...metadata,
    ...appFields,
    tenantId: 'private-tenant',
    slug: 'other-tenant',
  });
  await insert('private_suites', {
    id: suiteId,
    ...metadata,
    revision: 281,
    createdAt: 0,
    updatedAt: at + 1000,
    title: 'Current private suite',
    description: '',
    applicationIds: JSON.stringify([appId]),
  });
  for (let index = 0; index < 140; index++)
    await insert('suite_submissions', {
      suiteId,
      submittedRevision: 2 * index + 1,
      tenantId,
      ownerIdentityId: owner,
      title: index === 0 ? 'Approved suite' : `Retained version ${index}`,
      description: '',
      applicationIds: JSON.stringify([appId]),
      status: index === 0 ? 'approved' : 'rejected',
      reason: index === 0 ? '' : 'Please revise',
      submittedAt: index * 2,
      reviewedAt: index * 2 + 1,
      reviewerIdentityId: 'StaffIdentityExcluded',
    });
  await insert('suite_publications', {
    suiteId,
    submittedRevision: 1,
    publishedAt: 1,
    title: 'Approved suite',
    description: '',
    applicationIds: JSON.stringify([appId]),
  });
  await state('suite', suiteId);
  await insert('private_suites', {
    id: removedSuiteId,
    ...metadata,
    title: '',
    description: '',
    applicationIds: '[]',
    deletedAt: metadata.updatedAt,
  });
  await state('suite', removedSuiteId, { deletedAt: metadata.updatedAt });
  const fields = {
    title: 'Private article text',
    slug: 'export-article',
    excerpt: 'Article summary.',
    byline: 'Own byline',
    category: 'Guides',
    tags: [],
    sections: [
      { heading: 'Introduction', paragraphs: ['Retained article body.'] },
    ],
  };
  const reviewedFields = {
    ...fields,
    title: 'Approved article text',
    cover: { imageId: coverId, alt: 'Current cover' },
  };
  await insert('article_drafts', {
    id: articleId,
    ...metadata,
    revision: 5,
    fields: JSON.stringify(fields),
  });
  for (const revision of [1, 3])
    await insert('article_submissions', {
      articleId,
      submittedRevision: revision,
      sourcePublicationRevision: revision === 1 ? null : 1,
      fields: JSON.stringify({
        ...reviewedFields,
        cover: {
          imageId: revision === 1 ? retiredCoverId : coverId,
          alt: 'Retained cover reference',
        },
      }),
      status: 'approved',
      reason: '',
      submittedAt: at + revision,
      reviewedAt: at + revision + 1,
      reviewerIdentityId: 'StaffIdentityExcluded',
    });
  await insert('article_publications', {
    articleId,
    tenantId,
    ownerIdentityId: owner,
    slug: fields.slug,
    title: reviewedFields.title,
    category: fields.category,
    fields: JSON.stringify(reviewedFields),
    submittedRevision: 3,
    publishedAt: at + 2,
    updatedAt: at + 4,
  });
  await state('article', articleId, { revision: 2 });
  const releaseFields = {
    version: '1.0',
    channel: 'stable',
    type: 'minor',
    title: 'Published release',
    description: 'Reviewed changes.',
    releasedOn: '2026-10-12',
    changes: [{ type: 'fix', description: 'Fixed issue.' }],
  };
  const target = {
    applicationId: appId,
    releaseId,
    claimId,
    sourcePublicationRevision: null,
  };
  await insert('release_drafts', {
    id: releaseDraftId,
    ...metadata,
    ...target,
    fields: JSON.stringify({ ...releaseFields, title: 'Private release edit' }),
  });
  await insert('release_submissions', {
    draftId: releaseDraftId,
    submittedRevision: 1,
    target: JSON.stringify(target),
    fields: JSON.stringify(releaseFields),
    status: 'approved',
    reason: '',
    submittedAt: at + 1,
    reviewedAt: at + 2,
    reviewerIdentityId: 'StaffIdentityExcluded',
  });
  await insert('release_publications', {
    releaseId,
    applicationId: appId,
    tenantId,
    version: releaseFields.version,
    fields: JSON.stringify(releaseFields),
    publishedAt: at + 2,
    draftId: releaseDraftId,
    submittedRevision: 1,
  });
  await state('release', releaseId);
  await insert('application_ownership_claims', {
    id: claimId,
    tenantId,
    claimantIdentityId: owner,
    applicationId: appId,
    revision: 3,
    applicationRevision: 1,
    applicationName: appFields.name,
    applicationSlug: appFields.slug,
    website: appFields.website,
    hostname: 'example.com',
    evidenceUrl: 'https://example.com/proof',
    notes: 'My retained application claim notes',
    challengeName: '_wapps-ownership.example.com',
    challengeValue: 'wapps-ownership=' + 'c'.repeat(64),
    status: 'approved',
    createdAt: at,
    updatedAt: at + 4,
    expiresAt: at + 7 * 86400000,
    verifiedAt: at + 2,
    reviewedAt: at + 4,
    reviewerIdentityId: 'StaffIdentityExcluded',
    reason: '',
    checkCount: 1,
    lastCheckAt: at + 2,
  });
  await insert('application_ownership_decisions', {
    claimId,
    revision: 3,
    actorIdentityId: 'StaffIdentityExcluded',
    action: 'approve',
    reason: '',
    verifiedAt: at + 2,
    applicationRevision: 2,
    createdAt: at + 4,
  });
  await insert('application_ownership_grants', {
    applicationId: appId,
    tenantId,
    claimantIdentityId: owner,
    claimId,
    grantedAt: at + 4,
    revokedAt: null,
  });
  await source.transaction((manager) =>
    recordApplicationOwnershipHistory(manager, appId, tenantId, at + 4)
  );
  const categoryId = randomUUID(),
    tagId = randomUUID();
  for (const [kind, table, id] of [
    ['category', 'categories', categoryId],
    ['tag', 'tags', tagId],
  ]) {
    await insert(table, { id, name: 'Owned taxonomy', slug: kind + '-export' });
    await state(kind, id);
  }
  await insert('app_record_tags', { appRecordsId: appId, tagsId: tagId });
  await source.query('UPDATE app_records SET categoryId = ? WHERE id = ?', [
    categoryId,
    appId,
  ]);
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: 'qualification', secretAccessKey: password },
  });
  const bucket = 'export-images';
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    const bytes = await sharp(randomBytes(800 * 300 * 3), {
      raw: { width: 800, height: 300, channels: 3 },
    })
      .webp({ lossless: true })
      .toBuffer();
    assert.ok(bytes.length > 256 * 1024);
    const descriptor = {
      contentType: 'image/webp',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      width: 800,
      height: 300,
    };
    const asset = { id: imageId, purpose: 'banner', ...descriptor },
      cover = { id: coverId, ...descriptor };
    const applications = new S3ApplicationImages(client, bucket);
    const covers = new S3ApplicationImages(
      client,
      bucket,
      articleCoverObjectKey
    );
    const images = {
      applications,
      articles: {
        read: (value, current) =>
          covers.read({ ...value, purpose: 'banner' }, current),
      },
    };
    await applications.putImmutable(asset, bytes);
    await covers.putImmutable({ ...cover, purpose: 'banner' }, bytes);
    const upload = {
      tenantId,
      ownerIdentityId: owner,
      sourceType: 'image/png',
      sourceBytes: bytes.length,
      sourceSha256: descriptor.sha256,
      revision: 2,
      status: 'ready',
      createdAt: at,
      expiresAt: at + APPLICATION_IMAGE_UPLOAD_LIFETIME,
      attempts: 1,
      leaseToken: null,
      leaseUntil: null,
      commandKey: null,
    };
    await insert('application_image_uploads', {
      ...upload,
      id: imageId,
      draftId: appId,
      purpose: 'banner',
      asset: JSON.stringify(asset),
    });
    await insert('article_cover_uploads', {
      ...upload,
      id: coverId,
      articleId,
      asset: JSON.stringify(cover),
    });
    await source.transaction(async (manager) => {
      await recordEditorialMediaAsset(manager, {
        kind: 'application',
        imageId,
        tenantId,
        articleId: null,
        asset,
        createdAt: at,
        retiredAt: null,
      });
      await recordEditorialMediaAsset(manager, {
        kind: 'article',
        imageId: coverId,
        tenantId,
        articleId,
        asset: cover,
        createdAt: at,
        retiredAt: null,
      });
    });
    await insert('article_cover_uploads', {
      ...upload,
      id: retiredCoverId,
      articleId,
      asset: JSON.stringify({ ...cover, id: retiredCoverId }),
    });
    await source.transaction(async (manager) => {
      await recordEditorialMediaAsset(manager, {
        kind: 'article',
        imageId: retiredCoverId,
        tenantId,
        articleId,
        asset: { ...cover, id: retiredCoverId },
        createdAt: at,
        retiredAt: null,
      });
      await retireArticleCover(
        manager,
        retiredCoverId,
        2,
        at + 10,
        'cancelled'
      );
    });
    await insert('application_draft_images', {
      draftId: appId,
      purpose: 'banner',
      imageId,
      url: null,
    });
    await insert('application_submission_images', {
      draftId: appId,
      submittedRevision: 1,
      purpose: 'banner',
      imageId,
      url: null,
    });
    await insert('application_published_images', {
      applicationId: appId,
      purpose: 'banner',
      imageId,
      url: `https://example.com/api/media/applications/${appId}/banner/${imageId}`,
      publicationRevision: 1,
    });
    for (const kind of ['submission', 'publication'])
      await insert('article_cover_references', {
        articleId,
        kind,
        imageId: coverId,
      });
    const sourceReader = new MysqlEditorialAccountExportSource(source, images);
    const capture = () => collect(sourceReader.capture(owner, signal()));
    const entries = await capture();
    assert.equal(entries[0].type, 'begin');
    assert.equal(entries.at(-1).records, entries.length - 2);
    assert.equal(data(entries, 'applications.drafts').length, 4);
    assert.equal(
      data(entries, 'catalog').find((row) => row.resourceId === removedAppId)
        .content.name,
      ''
    );
    assert.equal(data(entries, 'suites.submissions').length, 140);
    assert.equal(
      data(entries, 'suites.publications')[0].content.title,
      'Approved suite'
    );
    assert.equal(
      data(entries, 'suites.drafts').find((row) => row.id === removedSuiteId)
        .content,
      null
    );
    assert.equal(data(entries, 'articles.submissions').length, 2);
    assert.equal(data(entries, 'articles.cover-uploads').length, 2);
    assert.equal(
      data(entries, 'releases.publications')[0].content.title,
      'Published release'
    );
    assert.equal(
      data(entries, 'ownership.claims')[0].notes,
      'My retained application claim notes'
    );
    assert.equal(data(entries, 'ownership.decisions').length, 1);
    assert.equal(data(entries, 'ownership.grants').length, 1);
    const published = data(entries, 'catalog').find(
      (row) => row.resourceId === appId
    );
    assert.equal(published.resourceId, appId);
    assert.deepEqual(published.content.tagIds, [tagId]);
    assert.equal(published.content.createdAtSql, '2026-10-12 00:00:00.123456');
    assert.equal(data(entries, 'applications.image-bindings').length, 3);
    for (const collection of [
      'applications.image-bytes',
      'articles.cover-bytes',
    ]) {
      const chunks = data(entries, collection);
      assert.ok(chunks.length > 1);
      assert.deepEqual(
        Buffer.concat(chunks.map((row) => Buffer.from(row.bytes, 'base64'))),
        bytes
      );
      assert.ok(
        chunks.every((row, index) => row.offset === index * 256 * 1024)
      );
    }
    const serialized = JSON.stringify(entries);
    for (const excluded of [
      'StaffIdentityExcluded',
      'Foreign private draft excluded',
      'Foreign canonical content excluded',
      'challengeValue',
      'leaseToken',
      'commandKey',
      'wapps-ownership=',
    ])
      assert.ok(!serialized.includes(excluded), excluded);
    const empty = await collect(
      sourceReader.capture(owner.toLowerCase(), signal())
    );
    assert.equal(empty.length, 2);
    pass(
      'Editorial SQL export spans exact-owner tenants, all content families, 140 retained submissions, ownership history, tombstones, taxonomy, bindings and verified chunked media; excludes foreign data and secrets'
    );
    const active = sourceReader
      .capture(owner, signal())
      [Symbol.asyncIterator]();
    await active.next();
    await source.query(
      'UPDATE application_drafts SET description = ?, revision = revision + 1 WHERE id = ?',
      ['Concurrent private edit', appId]
    );
    const remaining = await collect({ [Symbol.asyncIterator]: () => active });
    assert.equal(
      data(remaining, 'applications.drafts').find((row) => row.id === appId)
        .content.description,
      appFields.description
    );
    assert.equal(
      data(await capture(), 'applications.drafts').find(
        (row) => row.id === appId
      ).content.description,
      'Concurrent private edit'
    );
    const controller = new AbortController(),
      cancelled = sourceReader
        .capture(owner, controller.signal)
        [Symbol.asyncIterator]();
    await cancelled.next();
    controller.abort();
    await assert.rejects(cancelled.next());
    const abandoned = sourceReader
      .capture(owner, signal())
      [Symbol.asyncIterator]();
    await abandoned.next();
    await abandoned.return();
    assert.ok((await capture()).at(-1).type === 'end');
    const reconnect = await new DataSource({
      ...source.options,
      migrationsRun: false,
    }).initialize();
    try {
      assert.equal(
        (
          await collect(
            new MysqlEditorialAccountExportSource(reconnect, images).capture(
              owner,
              signal()
            )
          )
        ).at(-1).type,
        'end'
      );
    } finally {
      await reconnect.destroy();
    }
    pass(
      'Editorial capture holds one SQL snapshot during concurrent edits, releases cancelled/abandoned snapshots, and survives a new database connection'
    );
    const key = applicationImageObjectKey(imageId);
    const restore = () =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: asset.contentType,
        })
      );
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    await assert.rejects(capture(), /unavailable/);
    await restore();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.alloc(bytes.length),
        ContentType: asset.contentType,
      })
    );
    await assert.rejects(capture(), /descriptor/);
    await restore();
    await source.query(
      'UPDATE suite_submissions SET ownerIdentityId = ? WHERE suiteId = ? AND submittedRevision = 1',
      [foreign, suiteId]
    );
    await assert.rejects(capture(), /canonical/);
    await source.query(
      'UPDATE suite_submissions SET ownerIdentityId = ? WHERE suiteId = ? AND submittedRevision = 1',
      [owner, suiteId]
    );
    pass(
      'Missing/corrupt retained media and inconsistent submission ownership fail capture without a success receipt'
    );
    await restart();
    async function http(
      body = { identityId: owner },
      headers = { 'x-account-export-reader': exportSecret },
      query = ''
    ) {
      return fetch(origin() + '/api/internal/account-export' + query, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    }
    const response = await http();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const streamed = (await response.text())
      .trim()
      .split('\n')
      .map((row) => JSON.parse(row));
    assert.equal(streamed.at(-1).records, streamed.length - 2);
    assert.equal(data(streamed, 'suites.submissions').length, 140);
    assert.equal((await http(undefined, {})).status, 401);
    assert.equal(
      (
        await http(undefined, {
          'x-account-export-reader': exportSecret,
          'x-user-id': owner,
        })
      ).status,
      401
    );
    assert.equal(
      (await http({ identityId: owner, tenantId: 'private-tenant' })).status,
      400
    );
    assert.equal(
      (await http(undefined, undefined, '?tenantId=private-tenant')).status,
      400
    );
    await restart();
    const restarted = await http();
    assert.equal(restarted.status, 200);
    await restarted.text();
    const runtime = qualifyArchive ? await qualifyArchive({ owner }) : null;
    await stopPolicy();
    assert.equal((await http()).status, 503);
    pass(
      'Compiled Editorial source HTTP streams canonical SQL/MinIO through real OPA, rejects mixed credentials/scope injection, survives process restart and denies policy outage'
    );
    if (runtime?.erased) {
      assert.deepEqual(data(await capture(), 'catalog'), []);
      assert.equal((await capture()).at(-1).records, 0);
      assert.deepEqual(await applications.read(asset, signal()), bytes);
      assert.deepEqual(
        await covers.read({ ...cover, purpose: 'banner' }, signal()),
        bytes
      );
      pass(
        'Completed cross-service erasure leaves no owner-attributed Editorial export records while preserving real published application and article image bytes'
      );
      return;
    }
    const racing = sourceReader
      .capture(owner, signal())
      [Symbol.asyncIterator]();
    await racing.next();
    await source.transaction(async (manager) => {
      await manager.query(
        "UPDATE application_image_uploads SET status = 'cancelled', asset = NULL, revision = revision + 1 WHERE id = ?",
        [imageId]
      );
      await manager.query(
        'UPDATE application_draft_images SET imageId = NULL WHERE imageId = ?',
        [imageId]
      );
      await manager.query(
        'DELETE FROM application_submission_images WHERE imageId = ?',
        [imageId]
      );
      await manager.query(
        'DELETE FROM application_published_images WHERE imageId = ?',
        [imageId]
      );
    });
    await applications.retire(imageId);
    await assert.rejects(
      collect({ [Symbol.asyncIterator]: () => racing }),
      /descriptor/
    );
    assert.equal(data(await capture(), 'applications.image-bytes').length, 0);
    pass(
      'Concurrent media retirement fails the old capture; a fresh capture exports retained metadata without inventing retired bytes'
    );
  } finally {
    client.destroy();
  }
}
module.exports = { qualifyEditorialAccountExport };
