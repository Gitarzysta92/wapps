const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const base = '../../apps/services/editorial/src/app/';
const { MysqlEditorialWorkspaceErasure } = require(base +
  'account-erasure/mysql-editorial-workspace-erasure');
const { editorialWorkspaceFamilies } = require(base +
  'account-erasure/editorial-workspace-erasure.tables');
const { EditorialWorkspaceErasure1791840012000 } = require(base +
  'account-erasure/editorial-workspace-erasure.migration');
const {
  MysqlAccountErasureParticipant,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');
const { MysqlApplicationImageCleanup } = require(base +
  'application-media/mysql-application-image-cleanup');
const { MysqlArticleCoverCleanup } = require(base +
  'article-covers/mysql-article-cover-cleanup');
const { ApplicationImageCleanup } = require(base +
  'application-media/application-image-cleanup');
const { MysqlApplicationImages } = require(base +
  'application-media/mysql-application-images');
const { S3ApplicationImages, applicationImageObjectKey } = require(base +
  'application-media/s3-application-images');
const { articleCoverObjectKey } = require(base +
  'article-covers/article-cover-storage');
const {
  parseApplicationImageAsset,
} = require('../../libs/domains/catalog/media/src');

module.exports = async function editorialWorkspaceErasureChecks({
  source,
  storage,
  restart,
  pass,
  owner,
  staff,
  ownership,
  app,
  article,
  logo,
  json,
  bytes,
}) {
  assert.equal(source.options.database, 'suites');
  const worker = () => new MysqlEditorialWorkspaceErasure(source);
  const input = { identityId: owner.identityId, revision: 11 };
  await assert.rejects(
    worker().advance(input),
    /Missing Editorial erasure request/
  );
  const suite = await json(201, 'POST', 'me/suites', {
    title: 'Retained anonymous suite',
    description: 'Preserve the approved collection.',
    applicationIds: [app.id],
  });
  let submitted = await json(201, 'POST', `me/suites/${suite.id}/submit`, {
    expectedRevision: suite.revision,
  });
  await json(
    201,
    'POST',
    `editorial/suite-reviews/${suite.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: submitted.revision,
      submittedRevision: submitted.submittedRevision,
    },
    staff
  );
  const extraApp = await json(201, 'POST', 'me/application-drafts', {
    name: 'Erasure release application',
    slug: 'erasure-release-app',
    website: 'https://erasure-release.example.test',
    description: 'Private release work ends without removing approved notes.',
  });
  const shared = await json(201, 'POST', 'me/application-images', {
    draftId: extraApp.id,
    purpose: 'logo',
    source: {
      contentType: 'image/png',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  });
  await json(
    200,
    'PUT',
    `me/application-images/${shared.id}/content`,
    bytes,
    owner,
    { 'content-type': 'application/octet-stream', 'if-match': '"1"' }
  );
  const sharedSelection = await json(
    200,
    'PUT',
    `me/application-drafts/${extraApp.id}/images`,
    { purpose: 'logo', imageId: shared.id, expectedRevision: extraApp.revision }
  );
  submitted = await json(
    201,
    'POST',
    `me/application-drafts/${extraApp.id}/submit`,
    { expectedRevision: sharedSelection.revision }
  );
  await json(
    201,
    'POST',
    `editorial/application-reviews/${extraApp.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: submitted.revision,
      submittedRevision: submitted.submittedRevision,
    },
    staff
  );
  const claim = await ownership.create(
    owner,
    {
      applicationId: extraApp.id,
      evidenceUrl: 'https://erasure-release.example.test/team',
      notes: 'I control the official domain of this application.',
    },
    randomUUID()
  );
  const proof = await ownership.change(
    owner,
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
  const editingSource = await json(
    200,
    'GET',
    `me/application-drafts/canonical/${extraApp.id}`
  );
  const editingDraft = await json(
    201,
    'POST',
    'me/application-drafts/from-application',
    {
      editing: {
        applicationId: extraApp.id,
        claimId: claim.id,
        sourcePublicationRevision: editingSource.sourcePublicationRevision,
      },
      fields: { ...editingSource.fields, slug: 'erasure-edited-proposal' },
    }
  );
  const replacement = await json(
    201,
    'POST',
    'me/application-drafts/from-application',
    {
      editing: {
        applicationId: extraApp.id,
        claimId: claim.id,
        sourcePublicationRevision: editingSource.sourcePublicationRevision,
      },
      fields: {
        ...editingSource.fields,
        slug: 'erasure-replacement-publication',
      },
    }
  );
  const cleared = await json(
    200,
    'PUT',
    `me/application-drafts/${replacement.id}/images`,
    { purpose: 'logo', imageId: null, expectedRevision: replacement.revision }
  );
  submitted = await json(
    201,
    'POST',
    `me/application-drafts/${replacement.id}/submit`,
    { expectedRevision: cleared.revision }
  );
  await json(
    201,
    'POST',
    `editorial/application-reviews/${replacement.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: submitted.revision,
      submittedRevision: submitted.submittedRevision,
    },
    staff
  );
  assert.equal(
    (
      await source.query(
        'SELECT applicationId FROM application_published_images WHERE imageId=?',
        [shared.id]
      )
    ).length,
    0
  );
  assert.equal(
    (
      await source.query(
        'SELECT draftId FROM application_draft_images WHERE imageId=?',
        [shared.id]
      )
    ).length,
    2,
    "image is shared only by the erased author's private drafts"
  );
  const release = await json(201, 'POST', 'me/releases', {
    applicationId: extraApp.id,
    claimId: claim.id,
    fields: {
      version: '2026.10',
      channel: 'stable',
      type: 'major',
      releasedOn: new Date().toISOString().slice(0, 10),
      title: 'Retained release',
      description:
        'Reviewed release content survives erasure of its private authoring history.',
      changes: [
        { type: 'security', description: 'Preserve canonical authority.' },
      ],
    },
  });
  let state = await json(200, 'GET', `me/releases/${release.id}/publication`);
  await json(201, 'POST', `me/releases/${release.id}/submit`, {
    expectedRevision: state.revision,
    expectedPublicationRevision: state.publicationRevision,
  });
  state = await json(200, 'GET', `me/releases/${release.id}/publication`);
  await json(
    201,
    'POST',
    `editorial/release-reviews/${release.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
      submittedRevision: state.latestSubmission.submittedRevision,
      reason: '',
    },
    staff
  );

  const caseOwner = { ...owner, identityId: owner.identityId.toLowerCase() };
  const peerArticle = await json(
    201,
    'POST',
    'me/articles',
    {
      title: 'Peer contribution',
      slug: 'peer-retained-article',
      excerpt: 'Another member keeps their reviewed article.',
      byline: 'Peer author',
      category: 'Guides',
      tags: [],
      sections: [
        {
          heading: 'Peer content',
          paragraphs: [
            'A departing staff member does not own this public contribution.',
          ],
        },
      ],
    },
    caseOwner
  );
  state = await json(
    200,
    'GET',
    `me/articles/${peerArticle.id}/publication`,
    undefined,
    caseOwner
  );
  await json(
    201,
    'POST',
    `me/articles/${peerArticle.id}/submit`,
    {
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
    },
    caseOwner
  );
  state = await json(
    200,
    'GET',
    `me/articles/${peerArticle.id}/publication`,
    undefined,
    caseOwner
  );
  await json(
    201,
    'POST',
    `editorial/article-reviews/${peerArticle.id}/decision`,
    {
      decision: 'approve',
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
      submittedRevision: state.latestSubmission.submittedRevision,
      reason: '',
    },
    { ...owner, roles: ['editorial:reviewer'] }
  );
  const caseDraft = await json(
    201,
    'POST',
    'me/application-drafts',
    {
      name: 'Case-sensitive private draft',
      slug: 'case-private-draft',
      website: 'https://private.example.test',
      description: 'Private draft content for erasure isolation.',
    },
    caseOwner
  );
  await json(
    201,
    'POST',
    'me/application-drafts',
    {
      name: 'Other tenant private draft',
      slug: 'other-private-draft',
      website: 'https://private.example.test',
      description: 'Private draft content for erasure isolation.',
    },
    { ...owner, tenantId: 'other' }
  );

  const uploads = [{ kind: 'application', id: shared.id, ready: true }];
  for (const [kind, route, target] of [
    [
      'application',
      'application-images',
      { draftId: app.id, purpose: 'banner' },
    ],
    ['article', 'article-covers', { articleId: article.id }],
  ]) {
    for (const ready of [false, true]) {
      const upload = await json(201, 'POST', 'me/' + route, {
        ...target,
        source: {
          contentType: 'image/png',
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      });
      if (ready)
        await json(
          200,
          'PUT',
          `me/${route}/${upload.id}/content`,
          bytes,
          owner,
          { 'content-type': 'application/octet-stream', 'if-match': '"1"' }
        );
      uploads.push({ kind, id: upload.id, ready });
    }
  }
  const delayed = uploads.find(
    (upload) => upload.kind === 'application' && !upload.ready
  );
  const command = {
    actor: owner,
    id: delayed.id,
    key: randomUUID(),
    fingerprint: 'a'.repeat(64),
    at: Date.now(),
    expectedRevision: 1,
    sourceBytes: bytes.length,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const imageStore = new MysqlApplicationImages(source);
  const reservation = await imageStore.reserve(command);
  assert.ok(
    reservation.lease,
    'real upload is paused after canonical reservation'
  );
  const [privateReceipt] = await source.query(
    'SELECT * FROM application_image_commands WHERE imageId=? AND commandKey=?',
    [delayed.id, command.key]
  );

  const targets = {
    application: app.id,
    suite: suite.id,
    article: article.id,
    release: release.id,
  };
  // Large history is a validated SQL stress fixture; ordinary publication/upload paths above use real HTTP and OPA.
  for (const family of editorialWorkspaceFamilies) {
    const id = targets[family.kind];
    const [original] = await source.query(
      `SELECT * FROM ${family.submissions} WHERE ${family.parent}=? ORDER BY submittedRevision DESC LIMIT 1`,
      [id]
    );
    const columns = Object.keys(original);
    for (let index = 1; index <= 130; index++) {
      const revision = Number(original.submittedRevision) + index;
      await source.query(
        `INSERT INTO ${family.submissions} (${columns.join(
          ','
        )}) SELECT ${columns
          .map((column) => (column === 'submittedRevision' ? '?' : column))
          .join(',')} FROM ${family.submissions} WHERE ${
          family.parent
        }=? AND submittedRevision=?`,
        [revision, id, original.submittedRevision]
      );
      if (family.kind === 'application')
        await source.query(
          'INSERT INTO application_submission_images (draftId,submittedRevision,purpose,imageId,url) SELECT draftId,?,purpose,imageId,url FROM application_submission_images WHERE draftId=? AND submittedRevision=?',
          [revision, id, original.submittedRevision]
        );
    }
    await source.query(`UPDATE ${family.drafts} SET revision=1000 WHERE id=?`, [
      id,
    ]);
    const [table, parent] = family.commands[0];
    const [receipt] = await source.query(
      `SELECT * FROM ${table} WHERE ${parent}=? LIMIT 1`,
      [id]
    );
    const receiptColumns = Object.keys(receipt);
    for (let index = 0; index < 130; index++)
      await source.query(
        `INSERT INTO ${table} (${receiptColumns.join(
          ','
        )}) SELECT ${receiptColumns
          .map((column) => (column === 'commandKey' ? '?' : column))
          .join(',')} FROM ${table} WHERE ${parent}=? AND commandKey=? LIMIT 1`,
        [randomUUID(), id, receipt.commandKey]
      );
  }
  const validate = async () => {
    const runner = source.createQueryRunner();
    try {
      for (const migration of source.migrations)
        if (
          /^(ApplicationDrafts|ApplicationPublication|ApplicationEditing|ApplicationImages|ApplicationImageBindings|ApplicationImageCleanup|SuiteWorkspace|SuitePublication|ArticleWorkspace|ArticleCovers|ArticleCoverReferences|ArticleCoverCleanup|ReleaseWorkspace|EditorialMediaAssets|EditorialWorkspaceErasure)/.test(
            migration.constructor.name
          )
        )
          await migration.up(runner);
    } finally {
      await runner.release();
    }
  };
  await validate();
  const participant = new MysqlAccountErasureParticipant('editorial', source);
  await participant.request(input);
  assert.equal(await worker().advance(input), 'pending');
  assert.equal(
    (
      await source.query('SELECT id FROM article_drafts WHERE id=?', [
        article.id,
      ])
    ).length,
    1
  );
  await assert.rejects(
    worker().advance({ ...input, revision: input.revision + 1 }),
    /exact erasure request/
  );
  pass(
    'real application/suite/article/release publication and both upload families; validated 131-submission and >128-command stress histories; missing/stale requests and still-owned canonical content prevent private erasure'
  );

  return async function erase(input) {
    const publicBefore = {};
    for (const table of [
      'app_records',
      'editorial_resource_states',
      'editorial_outbox',
      'suite_publications',
      'article_publications',
      'release_publications',
      'application_published_images',
    ])
      publicBefore[table] = await source.query(`SELECT * FROM ${table}`);
    const count = async (table, column, id) =>
      Number(
        (
          await source.query(
            `SELECT COUNT(*) AS total FROM ${table} WHERE ${column}=?`,
            [id]
          )
        )[0].total
      );
    const counts = async () =>
      Promise.all(
        editorialWorkspaceFamilies.flatMap((family) => [
          count(family.submissions, family.parent, targets[family.kind]),
          ...family.commands.map(([table, parent]) =>
            count(table, parent, targets[family.kind])
          ),
        ])
      );
    const beforeFailure = await counts();
    await source.query(
      "CREATE TRIGGER qualification_erasure_delete_failure BEFORE DELETE ON application_draft_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected private erasure failure'"
    );
    try {
      await assert.rejects(
        worker().advance(input),
        /Injected private erasure failure/
      );
    } finally {
      await source.query('DROP TRIGGER qualification_erasure_delete_failure');
    }
    assert.deepEqual(await counts(), beforeFailure);
    const client = new S3Client(storage);
    const objects = (kind) =>
      new S3ApplicationImages(
        client,
        'retained-media',
        kind === 'application'
          ? applicationImageObjectKey
          : articleCoverObjectKey
      );
    let restarted = false,
      crashed = false,
      checkedCap = false,
      retired = false,
      calls = 0;
    const seenHistories = new Set();
    try {
      for (;;) {
        assert.ok(++calls < 120, 'bounded cleanup must make progress');
        const before = await counts();
        const result = await worker().advance(input);
        const after = await counts();
        after.forEach((value, index) => {
          assert.ok(
            before[index] - value >= 0 && before[index] - value <= 128,
            'one history batch is bounded'
          );
          if (before[index] - value === 128) seenHistories.add(index);
        });
        const remaining = Number(
          (
            await source.query(
              'SELECT COUNT(*) AS total FROM application_image_uploads WHERE ownerIdentityId=?',
              [owner.identityId]
            )
          )[0].total
        );
        if (remaining < 4)
          for (const family of editorialWorkspaceFamilies)
            assert.equal(
              Number(
                (
                  await source.query(
                    `SELECT COUNT(*) AS total FROM ${family.drafts} WHERE ownerIdentityId=? AND deletedAt IS NULL`,
                    [owner.identityId]
                  )
                )[0].total
              ),
              0,
              'all owned private references drain before any uploader history is removed'
            );
        if (result === 'drained') break;
        const [draft] = await source.query(
          'SELECT deletedAt FROM application_drafts WHERE id=?',
          [app.id]
        );
        if (draft?.deletedAt !== null && draft && !checkedCap) {
          // The cap protects atomic media-history removal from corrupt unbounded command rows.
          checkedCap = true;
          const [first] = await source.query(
            'SELECT id FROM application_image_uploads WHERE draftId=? ORDER BY id LIMIT 1',
            [app.id]
          );
          const [original] = await source.query(
            'SELECT * FROM application_image_commands WHERE imageId=? LIMIT 1',
            [first.id]
          );
          const keys = Object.keys(original),
            added = [];
          for (let index = 0; index < 13; index++) {
            const key = randomUUID();
            added.push(key);
            await source.query(
              `INSERT INTO application_image_commands (${keys.join(
                ','
              )}) SELECT ${keys
                .map((column) => (column === 'commandKey' ? '?' : column))
                .join(
                  ','
                )} FROM application_image_commands WHERE imageId=? AND commandKey=?`,
              [key, first.id, original.commandKey]
            );
          }
          const { eraseEditorialWorkspaceMedia } = require(base +
            'account-erasure/mysql-editorial-workspace-media-erasure');
          const runner = source.createQueryRunner();
          await runner.startTransaction();
          try {
            await assert.rejects(
              eraseEditorialWorkspaceMedia(
                runner.manager,
                'application',
                {
                  id: app.id,
                  tenantId: owner.tenantId,
                  ownerIdentityId: owner.identityId,
                },
                Date.now()
              ),
              /bounded Editorial upload history/
            );
          } finally {
            await runner.rollbackTransaction();
            await runner.release();
          }
          for (const key of added)
            await source.query(
              'DELETE FROM application_image_commands WHERE commandKey=? AND imageId=?',
              [key, first.id]
            );
        }
        if (!restarted && draft?.deletedAt !== null && draft) {
          await validate();
          await restart();
          restarted = true;
        }
        if (result === 'media-pending') {
          retired = true;
          assert.deepEqual(
            await Promise.all([
              worker().advance(input),
              worker().advance(input),
            ]),
            ['media-pending', 'media-pending']
          );
          for (const kind of ['application', 'article']) {
            const Store =
              kind === 'application'
                ? MysqlApplicationImageCleanup
                : MysqlArticleCoverCleanup;
            const store = new Store(source);
            if (!crashed) {
              const lease = await store.claim(Date.now());
              if (lease) {
                await objects(kind).retire(lease.imageId);
                await restart();
                assert.equal(
                  await worker().advance(input),
                  'media-pending',
                  'object write without SQL receipt cannot complete erasure'
                );
                // Advance the disposable lease clock to model takeover after process loss.
                const takeoverAt = Date.now() + 31_000;
                const next = await store.claim(takeoverAt);
                assert.ok(next);
                assert.equal(next.imageId, lease.imageId);
                await objects(kind).retire(next.imageId);
                assert.equal(await store.complete(lease, takeoverAt), false);
                assert.equal(await store.complete(next, takeoverAt), true);
                crashed = true;
              }
            }
            await new ApplicationImageCleanup(store, objects(kind)).runBatch(
              20
            );
          }
        }
      }
      assert.ok(restarted && crashed && retired && checkedCap);
      assert.ok(
        seenHistories.size >= 8,
        'all four families cross submission and command batch boundaries'
      );
      assert.equal(await worker().advance(input), 'drained');
      assert.deepEqual(
        await Promise.all([worker().advance(input), worker().advance(input)]),
        ['drained', 'drained']
      );
      const receiptColumns = Object.keys(privateReceipt);
      await source.query(
        `INSERT INTO application_image_commands (${receiptColumns.join(
          ','
        )}) VALUES (${receiptColumns.map(() => '?').join(',')})`,
        receiptColumns.map((column) => privateReceipt[column])
      );
      await assert.rejects(
        worker().advance(input),
        /Orphaned Editorial media history/
      );
      await source.query(
        'DELETE FROM application_image_commands WHERE imageId=?',
        [delayed.id]
      );
      await source.query(
        'UPDATE identity_erasure_requests SET completedAt=requestedAt WHERE identityId=?',
        [owner.identityId]
      );
      await assert.rejects(worker().advance(input), /pending erasure request/);
      await source.query(
        'UPDATE identity_erasure_requests SET completedAt=NULL WHERE identityId=?',
        [owner.identityId]
      );
      for (const upload of uploads) {
        const key =
          upload.kind === 'application'
            ? applicationImageObjectKey
            : articleCoverObjectKey;
        const marker = await client.send(
          new HeadObjectCommand({
            Bucket: 'retained-media',
            Key: key(upload.id),
          })
        );
        assert.equal(marker.ContentLength, 0);
      }
      const delayedAsset = {
        ...parseApplicationImageAsset(
          typeof logo.descriptor.asset === 'string'
            ? JSON.parse(logo.descriptor.asset)
            : logo.descriptor.asset
        ),
        id: delayed.id,
      };
      await assert.rejects(
        objects('application').putImmutable(delayedAsset, logo.bytes)
      );
      await assert.rejects(
        imageStore.complete(
          command,
          reservation.lease,
          delayedAsset,
          Date.now()
        )
      );
    } finally {
      client.destroy();
    }
    await validate();
    for (const [table, rows] of Object.entries(publicBefore))
      assert.deepEqual(
        await source.query(`SELECT * FROM ${table}`),
        rows,
        `${table} stays exact during private cleanup`
      );
    for (const family of editorialWorkspaceFamilies) {
      assert.equal(
        await count(family.drafts, 'ownerIdentityId', owner.identityId),
        0
      );
      assert.equal(
        await count(family.workspace, 'ownerIdentityId', owner.identityId),
        0
      );
      for (const [table, , actor] of family.commands)
        assert.equal(await count(table, actor, owner.identityId), 0);
    }
    for (const prefix of ['application_image', 'article_cover']) {
      assert.equal(
        await count(prefix + '_uploads', 'ownerIdentityId', owner.identityId),
        0
      );
      assert.equal(
        await count(prefix + '_commands', 'ownerIdentityId', owner.identityId),
        0
      );
    }
    assert.equal(await count('application_drafts', 'id', caseDraft.id), 1);
    assert.equal(
      await count('application_editing_targets', 'draftId', editingDraft.id),
      0
    );
    assert.equal(await count('article_drafts', 'id', peerArticle.id), 1);
    const [peerDecision] = await source.query(
      'SELECT reviewerIdentityId,status FROM article_submissions WHERE articleId=?',
      [peerArticle.id]
    );
    assert.equal(peerDecision.status, 'approved');
    assert.equal(
      peerDecision.reviewerIdentityId,
      owner.identityId,
      'staff attribution awaits the separate audit-erasure phase'
    );
    assert.equal((await participant.request(input)).state, 'pending');
    await restart();
    assert.equal(
      (
        await json(
          200,
          'GET',
          `me/application-drafts/${caseDraft.id}`,
          undefined,
          caseOwner
        )
      ).id,
      caseDraft.id
    );
    await json(403, 'POST', 'me/application-drafts', {
      name: 'Blocked erased author',
      slug: 'blocked-erased-author',
      website: 'https://blocked.example.test',
      description: 'The permanent identity barrier rejects fresh authoring.',
    });
    pass(
      'production workspace erasure drains all four families across bounded history batches and multiple tenants; case-distinct owner and canonical snapshots/outbox remain exact; SQL rollback and restart preserve valid intermediate migrations'
    );
    pass(
      'real pending/ready unused images and covers receive permanent MinIO markers before private history deletion; crash between object write and receipt stays pending, takeover fences stale completion, delayed upload cannot recreate bytes; full participant intentionally remains pending'
    );

    const runner = source.createQueryRunner();
    try {
      await new EditorialWorkspaceErasure1791840012000().up(runner);
      await source.query(
        'ALTER TABLE article_drafts ALTER INDEX idx_erasure_owner INVISIBLE'
      );
      await assert.rejects(
        new EditorialWorkspaceErasure1791840012000().up(runner),
        /erasure index/
      );
      await source.query(
        'ALTER TABLE article_drafts ALTER INDEX idx_erasure_owner VISIBLE'
      );
      await source.query('DROP INDEX idx_erasure_owner ON article_drafts');
      await assert.rejects(
        new EditorialWorkspaceErasure1791840012000().up(runner),
        /erasure index/
      );
      await source.query(
        'CREATE INDEX idx_erasure_owner ON article_drafts (ownerIdentityId,id)'
      );
      await new EditorialWorkspaceErasure1791840012000().up(runner);
      await assert.rejects(
        new EditorialWorkspaceErasure1791840012000().down(),
        /reviewed/
      );
    } finally {
      await runner.release();
    }
    pass(
      'additive erasure index migration reenters after private history removal and rejects invisible/missing applied indexes and destructive rollback'
    );
  };
};
