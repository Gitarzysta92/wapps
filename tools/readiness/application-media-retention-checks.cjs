const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const sharp = require('sharp');
const {
  S3Client,
  HeadObjectCommand,
  CreateBucketCommand,
  PutBucketVersioningCommand,
} = require('@aws-sdk/client-s3');

async function applicationMediaRetentionChecks({
  root,
  source,
  policy,
  pass,
  objects: configuration,
  origin,
  secret,
  restart,
  configureCleanup,
  maintenance,
}) {
  const load = (name) =>
    require(path.join(root, 'apps/services/editorial/src/app', name));
  const { ApplicationImages } = load('application-media/application-images');
  const { MysqlApplicationImages } = load(
    'application-media/mysql-application-images'
  );
  const { ApplicationImageCleanup } = load(
    'application-media/application-image-cleanup'
  );
  const { MysqlApplicationImageCleanup } = load(
    'application-media/mysql-application-image-cleanup'
  );
  const { ApplicationImageCleanup1791676816000 } = load(
    'application-media/application-image-cleanup.migration'
  );
  const { ApplicationImages1791676814000 } = load(
    'application-media/application-images.migration'
  );
  const { ApplicationImageBindings1791676815000 } = load(
    'application-media/application-image-bindings.migration'
  );
  const { S3ApplicationImages, applicationImageObjectKey } = load(
    'application-media/s3-application-images'
  );
  const { SharpApplicationImages } = load(
    'application-media/sharp-application-images'
  );
  const { ApplicationDrafts } = load('application-drafts/application-drafts');
  const { MysqlApplicationDrafts } = load(
    'application-drafts/mysql-application-drafts'
  );
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
  const bucket = 'private-application-images';
  const objects = new S3ApplicationImages(client, bucket);
  const store = new MysqlApplicationImages(source);
  const cleanupStore = new MysqlApplicationImageCleanup(source);
  const normalizer = new SharpApplicationImages();
  const actor = {
    identityId: 'RetentionOwner',
    tenantId: 'default',
    roles: [],
  };
  let now = Date.now();
  const images = new ApplicationImages(
    store,
    normalizer,
    objects,
    policy,
    { generate: randomUUID },
    () => now
  );
  const drafts = new ApplicationDrafts(
    new MysqlApplicationDrafts(source),
    policy,
    { generate: randomUUID },
    () => now
  );
  const cleanup = new ApplicationImageCleanup(cleanupStore, objects, () => now);
  const bytes = await sharp({
    create: { width: 64, height: 32, channels: 3, background: 'orange' },
  })
    .png()
    .toBuffer();
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const descriptor = {
    contentType: 'image/png',
    bytes: bytes.length,
    sha256: digest(bytes),
  };
  const fields = () => ({
    name: 'Retention qualification',
    slug: 'retention-' + randomUUID(),
    website: 'https://example.test',
    description: 'Recoverable private media.',
  });
  const createDraft = () =>
    drafts.change(actor, 'create', null, fields(), randomUUID());
  const create = (draftId) =>
    images.create(
      actor,
      { draftId, purpose: 'logo', source: descriptor },
      randomUUID()
    );
  const upload = async (draftId) => {
    const created = await create(draftId);
    const key = randomUUID();
    await images.upload(actor, created.id, { expectedRevision: 1 }, bytes, key);
    return { ...(await images.read(actor, created.id)), key };
  };
  const job = async (id) =>
    (
      await source.query(
        'SELECT * FROM application_image_cleanup WHERE imageId = ?',
        [id]
      )
    )[0];
  const marker = async (id) => {
    const value = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: applicationImageObjectKey(id),
      })
    );
    assert.equal(value.ContentLength, 0);
    assert.equal(value.ContentType, 'application/x-wapps-retired-image');
    assert.equal(value.Metadata['retired-image-id'], id);
  };
  const drain = async () => {
    for (let index = 0; index < 30; index++) {
      const report = await cleanup.runBatch(50);
      assert.equal(
        report.failed + report.scheduled + report.unconfirmed,
        0,
        JSON.stringify(report)
      );
      if (!report.retired && !report.attempted) return;
    }
    throw new Error('Cleanup did not drain within the bounded qualification');
  };
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    const draft = await createDraft();
    const pending = await create(draft.id);
    const ready = await upload(draft.id);
    assert.deepEqual(
      new Set((await images.list(actor, draft.id)).map((value) => value.id)),
      new Set([pending.id, ready.id])
    );
    for (const other of [
      { ...actor, identityId: 'Other' },
      { ...actor, tenantId: 'other' },
      { ...actor, identityId: 'retentionowner', roles: ['admin'] },
    ]) {
      await assert.rejects(images.list(other, draft.id), /not found/);
      await assert.rejects(
        images.cancel(other, pending.id, { expectedRevision: 1 }, randomUUID()),
        /not found/
      );
    }
    const cancelKey = randomUUID();
    const cancel = () =>
      images.cancel(actor, pending.id, { expectedRevision: 1 }, cancelKey);
    assert.deepEqual(await Promise.all([cancel(), cancel()]), [
      { id: pending.id, revision: 2, status: 'cancelled' },
      { id: pending.id, revision: 2, status: 'cancelled' },
    ]);
    await assert.rejects(
      images.cancel(actor, pending.id, { expectedRevision: 2 }, cancelKey),
      /another command/
    );
    await assert.rejects(
      images.cancel(actor, ready.id, { expectedRevision: 1 }, randomUUID()),
      /changed/
    );
    assert.equal(
      (
        await images.cancel(
          actor,
          ready.id,
          { expectedRevision: 2 },
          randomUUID()
        )
      ).revision,
      3
    );
    assert.equal(
      (
        await images.upload(
          actor,
          ready.id,
          { expectedRevision: 1 },
          bytes,
          ready.key
        )
      ).status,
      'ready'
    );
    assert.equal((await images.read(actor, ready.id)).status, 'cancelled');
    assert.equal((await images.list(actor, draft.id)).length, 0);
    await assert.rejects(images.content(actor, ready.id), /no ready image/);
    pass(
      'retained upload listing and cancellation enforce owner/tenant scope, revisions, exact idempotency and non-reviving historical receipts'
    );

    const rollback = await create(draft.id);
    await source.query(
      "CREATE TRIGGER fail_retention_receipt BEFORE INSERT ON application_image_commands FOR EACH ROW BEGIN IF NEW.commandKey = 'retention-rollback' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected receipt failure'; END IF; END"
    );
    try {
      await assert.rejects(
        images.cancel(
          actor,
          rollback.id,
          { expectedRevision: 1 },
          'retention-rollback'
        ),
        /Could not confirm/
      );
      assert.equal((await images.read(actor, rollback.id)).status, 'pending');
      assert.equal(await job(rollback.id), undefined);
    } finally {
      await source.query('DROP TRIGGER fail_retention_receipt');
    }
    await images.cancel(
      actor,
      rollback.id,
      { expectedRevision: 1 },
      'retention-rollback'
    );
    await drain();
    for (const id of [pending.id, ready.id, rollback.id]) {
      assert.ok((await job(id)).completedAt);
      await marker(id);
    }
    await assert.rejects(
      objects.putImmutable(
        ready.asset,
        await normalizer
          .normalize(bytes, 'logo', 'image/png')
          .then((value) => value.bytes)
      ),
      /immutable/
    );
    await marker(ready.id);
    assert.equal((await cancel()).status, 'cancelled');
    pass(
      'cancellation, retirement intent and receipt roll back together; real MinIO markers reclaim bytes and reject delayed immutable uploads'
    );

    for (let index = 0; index < 5; index++) {
      const id = randomUUID();
      const value = await normalizer.normalize(bytes, 'logo', 'image/png');
      const asset = {
        id,
        purpose: 'logo',
        contentType: 'image/webp',
        bytes: value.bytes.length,
        width: value.width,
        height: value.height,
        sha256: digest(value.bytes),
      };
      const outcomes = await Promise.allSettled([
        objects.retire(id),
        objects.putImmutable(asset, value.bytes),
      ]);
      assert.equal(outcomes[0].status, 'fulfilled');
      await marker(id);
      await objects.retire(id);
      await assert.rejects(objects.putImmutable(asset, value.bytes));
    }
    const versionedBucket = 'versioned-retention-' + randomUUID();
    await client.send(new CreateBucketCommand({ Bucket: versionedBucket }));
    for (const Status of ['Enabled', 'Suspended']) {
      await client.send(
        new PutBucketVersioningCommand({
          Bucket: versionedBucket,
          VersioningConfiguration: { Status },
        })
      );
      await assert.rejects(
        new S3ApplicationImages(client, versionedBucket).retire(randomUUID()),
        /unversioned bucket/
      );
    }
    pass(
      'concurrent real conditional PUT/retirement converges to a marker; enabled and suspended bucket versioning fail without false cleanup completion'
    );

    const active = await create(draft.id);
    const command = {
      actor,
      id: active.id,
      key: randomUUID(),
      at: now,
      expectedRevision: 1,
      sourceSha256: descriptor.sha256,
      sourceBytes: bytes.length,
      fingerprint: digest('late-completion'),
    };
    const reserved = await store.reserve(command);
    const normalized = await normalizer.normalize(bytes, 'logo', 'image/png');
    const asset = {
      id: active.id,
      purpose: 'logo',
      contentType: 'image/webp',
      bytes: normalized.bytes.length,
      width: normalized.width,
      height: normalized.height,
      sha256: digest(normalized.bytes),
    };
    await images.cancel(
      actor,
      active.id,
      { expectedRevision: 1 },
      randomUUID()
    );
    await drain();
    await assert.rejects(
      store.complete(command, reserved.lease, asset, now),
      /cancelled|changed/
    );
    await assert.rejects(objects.putImmutable(asset, normalized.bytes));
    await marker(active.id);
    const attached = await upload(draft.id);
    await drafts.changeImages(
      actor,
      draft.id,
      { expectedRevision: 1, purpose: 'logo', imageId: attached.id },
      randomUUID()
    );
    await assert.rejects(
      images.cancel(actor, attached.id, { expectedRevision: 2 }, randomUUID()),
      /still used/
    );
    for (let index = 0; index < 4; index++) {
      const concurrentDraft = await createDraft();
      const image = await upload(concurrentDraft.id);
      const results = await Promise.allSettled([
        drafts.changeImages(
          actor,
          concurrentDraft.id,
          { expectedRevision: 1, purpose: 'logo', imageId: image.id },
          randomUUID()
        ),
        images.cancel(actor, image.id, { expectedRevision: 2 }, randomUUID()),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1
      );
      const references = await source.query(
        'SELECT imageId FROM application_draft_images WHERE imageId = ?',
        [image.id]
      );
      assert.equal(
        (await images.read(actor, image.id)).status,
        references.length ? 'ready' : 'cancelled'
      );
    }
    await drain();
    pass(
      'upload completion and attach/cancel races serialize on authoritative rows; referenced images cannot be cancelled or revived by stale leases'
    );

    for (let index = 0; index < 4; index++) {
      now -= 7 * 24 * 60 * 60 * 1000;
      const racingDraft = await createDraft();
      const image = await upload(racingDraft.id);
      now += 7 * 24 * 60 * 60 * 1000;
      const outcomes = await Promise.allSettled([
        cleanupStore.retireUnused(now, 50),
        drafts.changeImages(
          actor,
          racingDraft.id,
          { expectedRevision: 1, purpose: 'logo', imageId: image.id },
          randomUUID()
        ),
      ]);
      assert.equal(outcomes[0].status, 'fulfilled');
      const row = await images.read(actor, image.id);
      assert.equal(
        outcomes[1].status,
        row.status === 'ready' ? 'fulfilled' : 'rejected'
      );
      assert.equal(
        (
          await source.query(
            'SELECT imageId FROM application_draft_images WHERE imageId = ?',
            [image.id]
          )
        ).length,
        row.status === 'ready' ? 1 : 0
      );
    }
    await drain();
    pass(
      'automatic retirement racing draft attachment either preserves the committed reference or fences attachment to the retired upload'
    );

    const retained = await source.query(
      'SELECT i.* FROM application_image_uploads i WHERE EXISTS (SELECT 1 FROM application_draft_images d WHERE d.imageId = i.id) OR EXISTS (SELECT 1 FROM application_submission_images s WHERE s.imageId = i.id) OR EXISTS (SELECT 1 FROM application_published_images p WHERE p.imageId = i.id)'
    );
    assert.ok(retained.length > 0);
    const unreferenced = await upload(draft.id);
    const expired = await create(draft.id);
    const removedDraft = await createDraft();
    const removed = await upload(removedDraft.id);
    await drafts.change(
      actor,
      'delete',
      removedDraft.id,
      { expectedRevision: 1 },
      randomUUID()
    );
    await drain();
    assert.equal((await job(removed.id)).reason, 'draft-deleted');
    assert.equal((await images.read(actor, unreferenced.id)).status, 'ready');
    now += 24 * 60 * 60 * 1000;
    await drain();
    assert.equal((await job(expired.id)).reason, 'expired');
    assert.equal((await images.read(actor, unreferenced.id)).status, 'ready');
    now += 7 * 24 * 60 * 60 * 1000;
    await drain();
    assert.equal((await job(unreferenced.id)).reason, 'unreferenced');
    for (const row of retained) {
      const [current] = await source.query(
        'SELECT * FROM application_image_uploads WHERE id = ?',
        [row.id]
      );
      assert.deepEqual(current, row);
      assert.equal(await job(row.id), undefined);
    }
    pass(
      'expiry, seven-day unused retention and deleted drafts reclaim unreferenced media while preserving every draft, frozen submission and published reference'
    );

    now = Date.now();
    const recovering = await upload(draft.id);
    await images.cancel(
      actor,
      recovering.id,
      { expectedRevision: 2 },
      randomUUID()
    );
    let lease = await cleanupStore.claim(now);
    assert.equal(lease.imageId, recovering.id);
    assert.equal(await cleanupStore.claim(now), null);
    const old = lease;
    now += 30000;
    lease = await new MysqlApplicationImageCleanup(source).claim(now);
    assert.notEqual(lease.token, old.token);
    assert.equal(await cleanupStore.complete(old, now), false);
    assert.equal(await cleanupStore.fail(old, now), 'stale');
    assert.equal(await cleanupStore.complete(lease, now - 1), false);
    await objects.retire(lease.imageId);
    // Simulate process death after object success but before a SQL completion receipt.
    now += 30000;
    const recovered = await new ApplicationImageCleanup(
      new MysqlApplicationImageCleanup(source),
      objects,
      () => now
    ).runBatch(1);
    assert.equal(recovered.completed, 1);
    await marker(recovering.id);
    assert.ok((await job(recovering.id)).completedAt);
    pass(
      'cleanup process loss, lease takeover, backwards clocks and object-success/SQL-receipt loss recover without accepting stale completions'
    );

    const failed = await upload(draft.id);
    await images.cancel(
      actor,
      failed.id,
      { expectedRevision: 2 },
      randomUUID()
    );
    const unavailable = new ApplicationImageCleanup(
      cleanupStore,
      {
        retire: async () => {
          throw new Error('injected storage outage');
        },
      },
      () => now
    );
    for (let attempt = 1; attempt <= 8; attempt++) {
      const report = await unavailable.runBatch(1);
      assert.equal(report.attempted, 1);
      assert.equal(report[attempt === 8 ? 'failed' : 'scheduled'], 1);
      const row = await job(failed.id);
      assert.equal(row.attempts, attempt);
      if (attempt < 8) {
        assert.equal(await cleanupStore.claim(now), null);
        now = Number(row.availableAt);
      }
    }
    assert.ok(
      (await cleanupStore.status()).failures.some(
        (row) => row.imageId === failed.id
      )
    );
    assert.equal(await cleanupStore.claim(now + 500000), null);
    assert.equal(await cleanupStore.requeue(failed.id, now - 1), false);
    assert.equal(await cleanupStore.requeue(failed.id, now), true);
    assert.equal(await cleanupStore.requeue(failed.id, now), false);
    assert.equal((await cleanup.runBatch(1)).completed, 1);
    assert.equal(await cleanupStore.requeue(failed.id, now), false);
    pass(
      'storage outages retain durable cleanup intent with eight bounded attempts and observable failure; explicit requeue recovers without reviving completed work'
    );

    const migration = new ApplicationImageCleanup1791676816000();
    await migration.up(runner);
    await new ApplicationImages1791676814000().up(runner);
    await new ApplicationImageBindings1791676815000().up(runner);
    await source.query(
      'RENAME TABLE application_image_cleanup TO retention_hidden_cleanup'
    );
    try {
      await assert.rejects(migration.up(runner), /schema is missing/);
      assert.equal(await runner.hasTable('application_image_cleanup'), false);
    } finally {
      await source.query(
        'RENAME TABLE retention_hidden_cleanup TO application_image_cleanup'
      );
    }
    await source.query(
      'UPDATE application_image_cleanup SET completedAt = createdAt - 1 WHERE imageId = ?',
      [failed.id]
    );
    try {
      await assert.rejects(migration.up(runner), /state|timestamp/);
    } finally {
      await source.query(
        'UPDATE application_image_cleanup SET completedAt = ? WHERE imageId = ?',
        [now, failed.id]
      );
    }
    const [receipt] = await source.query(
      "SELECT * FROM application_image_commands WHERE imageId = ? AND JSON_UNQUOTE(JSON_EXTRACT(receipt, '$.status')) = 'ready'",
      [failed.id]
    );
    await source.query(
      "UPDATE application_image_cleanup SET reason = 'expired' WHERE imageId = ?",
      [failed.id]
    );
    try {
      await assert.rejects(migration.up(runner), /relationships/);
    } finally {
      await source.query(
        "UPDATE application_image_cleanup SET reason = 'cancelled' WHERE imageId = ?",
        [failed.id]
      );
    }
    await source.query(
      'UPDATE application_image_commands SET receipt = NULL, completedAt = NULL WHERE imageId = ? AND commandKey = ?',
      [failed.id, receipt.commandKey]
    );
    try {
      await assert.rejects(migration.up(runner), /relationships/);
    } finally {
      await source.query(
        'UPDATE application_image_commands SET receipt = ?, completedAt = ? WHERE imageId = ? AND commandKey = ?',
        [
          typeof receipt.receipt === 'string'
            ? receipt.receipt
            : JSON.stringify(receipt.receipt),
          receipt.completedAt,
          failed.id,
          receipt.commandKey,
        ]
      );
    }
    await migration.up(runner);
    await assert.rejects(migration.down(), /data-preserving/);
    pass(
      'cleanup migration reentry preserves history and rejects missing completed schema, corrupt timestamps and lost ready receipts without destructive repair'
    );

    const request = (method, route, body, options = {}) =>
      fetch(origin() + '/api/' + route, {
        method,
        headers: {
          'content-type': 'application/json',
          'idempotency-key': options.key ?? randomUUID(),
          ...(options.user === null
            ? {}
            : {
                'x-user-id': options.user ?? 'RetentionHttpOwner',
                'x-user-claims': JSON.stringify({
                  tenantId: options.tenant ?? 'default',
                  roles: [],
                }),
                'x-ingress-auth': secret,
              }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000),
      });
    const json = async (
      method,
      route,
      body,
      options,
      expected = method === 'POST' ? 201 : 200
    ) => {
      const response = await request(method, route, body, options);
      const value = await response.json();
      assert.equal(response.status, expected, JSON.stringify(value));
      assert.match(response.headers.get('cache-control'), /no-store/);
      return value;
    };
    const httpDraft = await json('POST', 'me/application-drafts', fields());
    const httpInput = {
      draftId: httpDraft.id,
      purpose: 'logo',
      source: descriptor,
    };
    const httpImage = await json('POST', 'me/application-images', httpInput);
    const listPath = 'me/application-images?draftId=' + httpDraft.id;
    assert.equal((await json('GET', listPath)).length, 1);
    await restart();
    assert.equal((await json('GET', listPath))[0].id, httpImage.id);
    for (const options of [
      { user: null },
      { user: 'Other' },
      { tenant: 'other' },
    ]) {
      const expected = options.user === null ? 401 : 404;
      assert.equal(
        (await request('GET', listPath, undefined, options)).status,
        expected
      );
      assert.equal(
        (
          await request(
            'DELETE',
            'me/application-images/' + httpImage.id,
            { expectedRevision: 1 },
            options
          )
        ).status,
        expected
      );
    }
    assert.equal(
      (await request('GET', listPath + '&ownerIdentityId=Other')).status,
      400
    );
    assert.equal(
      (
        await request('DELETE', 'me/application-images/' + httpImage.id, {
          expectedRevision: 1,
          imageId: httpImage.id,
        })
      ).status,
      400
    );
    const options = { key: randomUUID() };
    const cancelled = await json(
      'DELETE',
      'me/application-images/' + httpImage.id,
      { expectedRevision: 1 },
      options
    );
    await restart();
    assert.deepEqual(
      await json(
        'DELETE',
        'me/application-images/' + httpImage.id,
        { expectedRevision: 1 },
        options
      ),
      cancelled
    );
    assert.deepEqual(await json('GET', listPath), []);
    const cli = JSON.parse(maintenance(['--media-cleanup']).trim());
    assert.ok(cli.completed > 0);
    await marker(httpImage.id);
    assert.equal(
      JSON.parse(maintenance(['--media-cleanup-status']).trim()).mode,
      'media-cleanup-status'
    );
    const exhausted = await json('POST', 'me/application-images', httpInput);
    await json('DELETE', 'me/application-images/' + exhausted.id, {
      expectedRevision: 1,
    });
    await source.query(
      "UPDATE application_image_cleanup SET attempts = 8, failedAt = ?, lastError = 'lease-attempts-exhausted' WHERE imageId = ?",
      [Date.now(), exhausted.id]
    );
    assert.throws(
      () => maintenance(['--media-cleanup']),
      (error) => {
        assert.equal(error.status, 2);
        assert.ok(
          JSON.parse(error.stdout.trim()).failures.some(
            (row) => row.imageId === exhausted.id
          )
        );
        return true;
      }
    );
    assert.equal(
      JSON.parse(maintenance(['--media-cleanup-requeue', exhausted.id]).trim())
        .requeued,
      true
    );
    assert.equal(
      JSON.parse(maintenance(['--media-cleanup']).trim()).completed,
      1
    );
    await marker(exhausted.id);
    const automatic = await json('POST', 'me/application-images', httpInput);
    await json('DELETE', 'me/application-images/' + automatic.id, {
      expectedRevision: 1,
    });
    await configureCleanup(true);
    for (let attempt = 0; attempt < 30; attempt++) {
      if ((await job(automatic.id)).completedAt !== null) break;
      await delay(200);
    }
    assert.ok((await job(automatic.id)).completedAt);
    await marker(automatic.id);
    await configureCleanup(false);
    pass(
      'compiled list/cancel routes recover across restarts with isolation and strict input; maintenance and opt-in API worker complete actual private-object cleanup'
    );
  } finally {
    await runner.release();
    client.destroy();
  }
}
module.exports = { applicationMediaRetentionChecks };
