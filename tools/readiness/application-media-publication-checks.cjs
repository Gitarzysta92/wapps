const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');

async function applicationMediaPublicationChecks({
  source,
  origin,
  restart,
  configurePublicOrigin,
  secret,
  pass,
}) {
  const owner = 'MediaPublicationOwner';
  const reviewer = {
    uid: 'MediaPublicationReviewer',
    roles: ['editorial:reviewer'],
  };
  const request = (method, route, body, options = {}) =>
    fetch(origin() + '/api/' + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'idempotency-key': options.key ?? randomUUID(),
        ...(options.uid === null
          ? {}
          : {
              'x-user-id': options.uid ?? owner,
              'x-user-claims': JSON.stringify({
                roles: options.roles ?? [],
                tenantId: options.tenant ?? 'default',
              }),
              'x-ingress-auth': secret,
            }),
        ...options.headers,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  const json = async (
    method,
    route,
    body,
    options = {},
    expected = method === 'POST' ? 201 : 200
  ) => {
    const response = await request(method, route, body, options);
    const value = await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${route}: ${JSON.stringify(value)}`
    );
    return value;
  };
  const preview = async (route, options = {}) => {
    const response = await request('GET', route, undefined, options);
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    return Buffer.from(await response.arrayBuffer());
  };
  const fields = (name) => ({
    name,
    slug: 'media-publication-' + randomUUID(),
    website: 'https://example.test',
    description: 'A reviewed application with immutable uploaded images.',
  });
  const createDraft = (name, options) =>
    json('POST', 'me/application-drafts', fields(name), options);
  const upload = async (draftId, purpose, color, options = {}) => {
    const bytes = await sharp({
      create: { width: 80, height: 40, channels: 3, background: color },
    })
      .png()
      .toBuffer();
    const reservation = await json(
      'POST',
      'me/application-images',
      {
        draftId,
        purpose,
        source: {
          contentType: 'image/png',
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      },
      options
    );
    await json(
      'PUT',
      `me/application-images/${reservation.id}/content`,
      bytes,
      {
        ...options,
        headers: {
          'content-type': 'application/octet-stream',
          'if-match': '"1"',
        },
      }
    );
    return {
      id: reservation.id,
      bytes: await preview(
        `me/application-images/${reservation.id}/content`,
        options
      ),
    };
  };
  const draft = await createDraft('Image publication');
  const base = 'me/application-drafts/' + draft.id;
  const a = await upload(draft.id, 'logo', 'red');
  const b = await upload(draft.id, 'logo', 'blue');
  const banner = await upload(draft.id, 'banner', 'green');
  assert.deepEqual((await json('GET', base)).images, {
    logo: null,
    banner: null,
  });
  assert.equal(
    (
      await request(
        'GET',
        `media/applications/${draft.id}/logo/${a.id}`,
        undefined,
        { uid: null }
      )
    ).status,
    404
  );
  const other = await createDraft('Other image workspace', {
    uid: 'OtherMediaOwner',
  });
  const foreign = await upload(other.id, 'logo', 'yellow', {
    uid: 'OtherMediaOwner',
  });
  const selection = (imageId, purpose, expectedRevision) => ({
    imageId,
    purpose,
    expectedRevision,
  });
  for (const [body, options, expected] of [
    [selection(foreign.id, 'logo', 1), {}, 404],
    [selection(a.id, 'logo', 1), { uid: 'OtherMediaOwner' }, 404],
    [selection(a.id, 'logo', 1), { tenant: 'other' }, 404],
    [selection(a.id, 'banner', 1), {}, 400],
    [
      { ...selection(a.id, 'logo', 1), url: 'https://caller.test/logo' },
      {},
      400,
    ],
  ])
    await json('PUT', base + '/images', body, options, expected);
  const sameOwnerDraft = await createDraft('Separate private draft');
  await json(
    'PUT',
    'me/application-drafts/' + sameOwnerDraft.id + '/images',
    selection(a.id, 'logo', 1),
    {},
    404
  );

  const race = await Promise.all([
    request('PUT', base + '/images', selection(a.id, 'logo', 1)),
    request('PUT', base + '/images', selection(banner.id, 'banner', 1)),
  ]);
  assert.deepEqual(race.map((response) => response.status).sort(), [200, 409]);
  let current = await json('GET', base);
  const missing = current.images.logo ? 'banner' : 'logo';
  const selected = missing === 'logo' ? a.id : banner.id;
  const key = randomUUID();
  const command = selection(selected, missing, current.revision);
  const attached = await json('PUT', base + '/images', command, { key });
  assert.deepEqual(
    await json('PUT', base + '/images', command, { key }),
    attached
  );
  await json(
    'PUT',
    base + '/images',
    { ...command, imageId: null },
    { key },
    409
  );
  current = await json('GET', base);
  assert.equal(current.images.logo.asset.id, a.id);
  assert.equal(current.images.banner.asset.id, banner.id);
  await json('PUT', base, {
    name: current.name,
    slug: current.slug,
    website: current.website,
    description: current.description + ' Text updated.',
    expectedRevision: current.revision,
  });
  current = await json('GET', base);
  assert.equal(current.images.logo.asset.id, a.id);
  assert.deepEqual(await preview(base + '/images/logo/content'), a.bytes);
  pass(
    'image association enforces owner/tenant/draft/purpose, shared draft revisions, competing-writer conflicts, exact retries and text preservation'
  );

  const submitted = await json('POST', base + '/submit', {
    expectedRevision: current.revision,
  });
  const submittedRevision = submitted.submittedRevision;
  const privateSubmission = `${base}/submissions/${submittedRevision}/images/logo/content`;
  const reviewPath = `editorial/application-reviews/${draft.id}/submissions/${submittedRevision}/images/logo/content`;
  await json(
    'PUT',
    base + '/images',
    selection(b.id, 'logo', submitted.revision)
  );
  current = await json('GET', base);
  await json(
    'PUT',
    base + '/images',
    selection(null, 'banner', current.revision)
  );
  current = await json('GET', base);
  assert.deepEqual(await preview(base + '/images/logo/content'), b.bytes);
  assert.deepEqual(await preview(privateSubmission), a.bytes);
  assert.deepEqual(await preview(reviewPath, reviewer), a.bytes);
  for (const route of [base + '/images/logo/content', privateSubmission]) {
    for (const options of [{ uid: 'OtherMediaOwner' }, { tenant: 'other' }])
      assert.equal(
        (await request('GET', route, undefined, options)).status,
        404
      );
  }
  for (const options of [
    {},
    { uid: owner, roles: reviewer.roles },
    { ...reviewer, tenant: 'other' },
  ]) {
    const status = (await request('GET', reviewPath, undefined, options))
      .status;
    assert.equal(status, options.tenant ? 404 : 403);
  }
  const decisionPath = `editorial/application-reviews/${draft.id}/decision`;
  const decision = {
    decision: 'approve',
    expectedRevision: current.revision,
    submittedRevision,
  };
  const publicTables = async () =>
    Promise.all(
      [
        'app_records',
        'editorial_resource_states',
        'editorial_outbox',
        'application_published_images',
        'application_publications',
        'application_publication_commands',
      ].map(async (table) => ({
        table,
        count: Number(
          (await source.query(`SELECT COUNT(*) AS total FROM ${table}`))[0]
            .total
        ),
      }))
    );
  const before = await publicTables();
  await configurePublicOrigin(undefined);
  await json('POST', decisionPath, decision, reviewer, 503);
  assert.deepEqual(await publicTables(), before);
  await configurePublicOrigin('https://media.example.test');
  const approveKey = randomUUID();
  for (const table of [
    'editorial_outbox',
    'application_published_images',
    'application_publication_commands',
  ]) {
    await source.query(
      `CREATE TRIGGER reject_media_publication BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification media publication rollback'`
    );
    try {
      await json(
        'POST',
        decisionPath,
        decision,
        { ...reviewer, key: approveKey },
        503
      );
      assert.deepEqual(await publicTables(), before);
      assert.equal(
        (await json('GET', base + '/publication')).latestSubmission.status,
        'submitted'
      );
      assert.equal((await json('GET', base)).revision, current.revision);
    } finally {
      await source.query('DROP TRIGGER reject_media_publication');
    }
  }
  const approved = await json('POST', decisionPath, decision, {
    ...reviewer,
    key: approveKey,
  });
  assert.deepEqual(
    await json('POST', decisionPath, decision, {
      ...reviewer,
      key: approveKey,
    }),
    approved
  );
  const [record] = await source.query(
    'SELECT logoUrl, bannerUrl FROM app_records WHERE id = ?',
    [draft.id]
  );
  const publicLogo = new URL(record.logoUrl).pathname.slice('/api/'.length);
  const publicBanner = new URL(record.bannerUrl).pathname.slice('/api/'.length);
  assert.deepEqual(await preview(publicLogo, { uid: null }), a.bytes);
  assert.deepEqual(await preview(publicBanner, { uid: null }), banner.bytes);
  assert.equal((await json('GET', base)).images.logo.asset.id, b.id);
  pass(
    'submission freezes reviewed images; missing configuration and outbox/reference/receipt failures roll back approval; exact retry atomically publishes the frozen media'
  );

  await restart();
  assert.deepEqual(await preview(publicLogo, { uid: null }), a.bytes);
  assert.deepEqual(await preview(privateSubmission), a.bytes);
  for (const [change, restore] of [
    [
      'UPDATE app_records SET isSuspended = 1 WHERE id = ?',
      'UPDATE app_records SET isSuspended = 0 WHERE id = ?',
    ],
    [
      "UPDATE editorial_resource_states SET tenantId = 'other' WHERE resourceKind = 'app' AND resourceId = ?",
      "UPDATE editorial_resource_states SET tenantId = 'default' WHERE resourceKind = 'app' AND resourceId = ?",
    ],
    [
      "UPDATE editorial_resource_states SET deletedAt = 1 WHERE resourceKind = 'app' AND resourceId = ?",
      "UPDATE editorial_resource_states SET deletedAt = NULL WHERE resourceKind = 'app' AND resourceId = ?",
    ],
  ]) {
    await source.query(change, [draft.id]);
    try {
      assert.equal(
        (await request('GET', publicLogo, undefined, { uid: null })).status,
        404
      );
    } finally {
      await source.query(restore, [draft.id]);
    }
  }
  await source.query('UPDATE app_records SET logoUrl = ? WHERE id = ?', [
    'https://replaced.example.test/logo.webp',
    draft.id,
  ]);
  assert.equal(
    (await request('GET', publicLogo, undefined, { uid: null })).status,
    404
  );
  await source.query('UPDATE app_records SET logoUrl = ? WHERE id = ?', [
    record.logoUrl,
    draft.id,
  ]);
  const withdrawn = await json('POST', base + '/withdraw', {
    expectedRevision: approved.revision,
  });
  assert.equal(
    (await request('GET', publicLogo, undefined, { uid: null })).status,
    404
  );
  const again = await json('POST', base + '/submit', {
    expectedRevision: withdrawn.revision,
  });
  const republished = await json(
    'POST',
    decisionPath,
    {
      decision: 'approve',
      expectedRevision: again.revision,
      submittedRevision: again.submittedRevision,
    },
    reviewer
  );
  const [nextRecord] = await source.query(
    'SELECT logoUrl, bannerUrl FROM app_records WHERE id = ?',
    [draft.id]
  );
  assert.equal(nextRecord.bannerUrl, null);
  const newPublicLogo = new URL(nextRecord.logoUrl).pathname.slice(
    '/api/'.length
  );
  assert.deepEqual(await preview(newPublicLogo, { uid: null }), b.bytes);
  assert.equal(
    (await request('GET', publicLogo, undefined, { uid: null })).status,
    404
  );
  assert.equal(
    (await request('GET', publicBanner, undefined, { uid: null })).status,
    404
  );
  pass(
    'public media survives API restart and checks current SQL visibility, tenant, suspension and exact URL; withdrawal and replacement hide old media without projection updates'
  );

  // This group deliberately supplies a canonical ownership grant; DNS/grant issuance has separate real-service qualification.
  const claimId = randomUUID();
  const successor = { uid: 'MediaSuccessor' };
  await source.query(
    "UPDATE editorial_resource_states SET ownerIdentityId = ? WHERE resourceKind = 'app' AND resourceId = ?",
    [successor.uid, draft.id]
  );
  await source.query(
    'INSERT INTO application_ownership_grants (applicationId, tenantId, claimantIdentityId, claimId, grantedAt, revokedAt) VALUES (?, ?, ?, ?, ?, NULL)',
    [draft.id, 'default', successor.uid, claimId, Date.now()]
  );
  const canonicalBase = 'me/application-drafts/canonical/' + draft.id;
  const canonical = await json('GET', canonicalBase, undefined, successor);
  assert.deepEqual(
    await preview(canonicalBase + '/images/logo/content', successor),
    b.bytes
  );
  assert.equal(
    (await request('GET', canonicalBase + '/images/logo/content')).status,
    404
  );
  const editing = {
    applicationId: draft.id,
    claimId,
    sourcePublicationRevision: canonical.sourcePublicationRevision,
  };
  const editingDraft = await json(
    'POST',
    'me/application-drafts/from-application',
    { editing, fields: canonical.fields },
    successor
  );
  const editingBase = 'me/application-drafts/' + editingDraft.id;
  assert.deepEqual(
    await preview(editingBase + '/images/logo/content', successor),
    b.bytes
  );
  await json('DELETE', base, { expectedRevision: republished.revision });
  assert.equal(
    (await request('GET', `me/application-images/${b.id}/content`)).status,
    404
  );
  assert.deepEqual(await preview(newPublicLogo, { uid: null }), b.bytes);
  assert.deepEqual(
    await preview(editingBase + '/images/logo/content', successor),
    b.bytes
  );
  const successorImage = await upload(
    editingDraft.id,
    'logo',
    'purple',
    successor
  );
  const replacement = await json(
    'PUT',
    editingBase + '/images',
    selection(successorImage.id, 'logo', 1),
    successor
  );
  await json(
    'POST',
    editingBase + '/rebase',
    {
      editing,
      fields: canonical.fields,
      expectedRevision: replacement.revision,
      imageChoices: { logo: 'canonical', banner: 'draft' },
    },
    successor
  );
  assert.equal(
    (await json('GET', editingBase, undefined, successor)).images.logo.asset.id,
    b.id
  );
  await source.query(
    'UPDATE application_ownership_grants SET revokedAt = ? WHERE applicationId = ?',
    [Date.now(), draft.id]
  );
  assert.equal(
    (
      await request(
        'GET',
        canonicalBase + '/images/logo/content',
        undefined,
        successor
      )
    ).status,
    404
  );
  const inherited = await json('GET', editingBase, undefined, successor);
  await json(
    'POST',
    editingBase + '/submit',
    { expectedRevision: inherited.revision },
    successor,
    403
  );
  await json(
    'DELETE',
    editingBase,
    { expectedRevision: inherited.revision },
    successor
  );
  assert.deepEqual(await preview(newPublicLogo, { uid: null }), b.bytes);
  pass(
    'ownership transfer preserves inherited media after original draft deletion; explicit rebase selects canonical images; revoked grants cannot publish or preview canonical source; private editing-draft deletion preserves publication'
  );

  const {
    ApplicationImageBindings1791676815000,
  } = require('../../apps/services/editorial/src/app/application-media/application-image-bindings.migration');
  const migration = new ApplicationImageBindings1791676815000();
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await migration.up(runner);
    const legacy = await createDraft('Legacy images');
    const legacyBase = 'me/application-drafts/' + legacy.id;
    const oldSubmission = await json('POST', legacyBase + '/submit', {
      expectedRevision: 1,
    });
    await source.query(
      'DELETE FROM application_submission_images WHERE draftId = ?',
      [legacy.id]
    );
    await source.query(
      'DELETE FROM application_draft_images WHERE draftId = ?',
      [legacy.id]
    );
    await assert.rejects(migration.up(runner), /snapshot is missing/);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM application_draft_images WHERE draftId = ?',
          [legacy.id]
        )
      ).length,
      0
    );
    const [history] = await source.query(
      'SELECT * FROM editorial_migrations WHERE name = ?',
      ['ApplicationImageBindings1791676815000']
    );
    await source.query('DELETE FROM editorial_migrations WHERE id = ?', [
      history.id,
    ]);
    try {
      await migration.up(runner);
      await migration.up(runner);
    } finally {
      await source.query(
        'INSERT INTO editorial_migrations (id, timestamp, name) VALUES (?, ?, ?)',
        [history.id, history.timestamp, history.name]
      );
    }
    assert.equal(
      (await json('GET', legacyBase + '/publication')).latestSubmission.images,
      null
    );
    await json(
      'POST',
      `editorial/application-reviews/${legacy.id}/decision`,
      {
        decision: 'approve',
        expectedRevision: oldSubmission.revision,
        submittedRevision: oldSubmission.submittedRevision,
      },
      reviewer,
      409
    );
    const resubmitted = await json('POST', legacyBase + '/submit', {
      expectedRevision: oldSubmission.revision,
    });
    assert.equal(
      (
        await source.query(
          'SELECT status FROM application_submissions WHERE applicationId = ? AND submittedRevision = ?',
          [legacy.id, oldSubmission.submittedRevision]
        )
      )[0].status,
      'cancelled'
    );
    await json(
      'POST',
      `editorial/application-reviews/${legacy.id}/decision`,
      {
        decision: 'approve',
        expectedRevision: resubmitted.revision,
        submittedRevision: resubmitted.submittedRevision,
      },
      reviewer
    );
    await source.query(
      'DELETE FROM application_draft_images WHERE draftId = ? AND purpose = ?',
      [legacy.id, 'banner']
    );
    await assert.rejects(migration.up(runner), /snapshot is incomplete/);
    await source.query(
      'INSERT INTO application_draft_images (draftId, purpose, imageId, url) VALUES (?, ?, NULL, NULL)',
      [legacy.id, 'banner']
    );
    await source.query(
      'UPDATE application_draft_images SET imageId = ? WHERE draftId = ? AND purpose = ?',
      [a.id, legacy.id, 'banner']
    );
    await assert.rejects(migration.up(runner), /unavailable asset/);
    await source.query(
      'UPDATE application_draft_images SET imageId = NULL WHERE draftId = ?',
      [legacy.id]
    );
    await migration.up(runner);
  } finally {
    await runner.release();
  }
  pass(
    'binding migration resumes initial backfill, rejects completed-migration data loss and corrupt/incomplete bindings, and legacy unknown submission images require fresh review'
  );
}

module.exports = { applicationMediaPublicationChecks };
