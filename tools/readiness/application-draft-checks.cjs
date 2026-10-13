const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

async function applicationDraftChecks({
  root,
  source,
  origin,
  headers,
  restart,
  stopPolicy,
  output,
  pass,
  browser,
}) {
  const { ApplicationDrafts1791676810000 } = require(path.join(
    root,
    'apps/services/editorial/src/app/application-drafts/application-drafts.migration'
  ));
  const fields = {
    name: 'Private Example',
    slug: 'private-example',
    website: 'https://example.test/' + 'a'.repeat(600),
    description: 'A private application draft with enough detail.',
  };
  async function request(
    method,
    route = '',
    body,
    key = randomUUID(),
    uid = 'DraftAlice',
    tenant = 'default'
  ) {
    const response = await fetch(
      origin() + '/api/me/application-drafts' + route,
      {
        method,
        headers: { ...headers(uid, tenant), 'idempotency-key': key },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000),
      }
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, json: await response.json() };
  }
  const count = async (table) =>
    Number(
      (await source.query(`SELECT COUNT(*) AS total FROM ${table}`))[0].total
    );
  const before = {
    records: await count('app_records'),
    states: await count('editorial_resource_states'),
    outbox: await count('editorial_outbox'),
  };
  assert.deepEqual((await request('GET')).json, []);
  assert.equal(
    (await fetch(origin() + '/api/me/application-drafts')).status,
    401
  );
  assert.equal(
    (
      await fetch(origin() + '/api/me/application-drafts', {
        headers: { 'x-user-id': 'spoofed' },
      })
    ).status,
    401
  );
  for (const extra of ['ownerIdentityId', 'tenantId', 'visibility', 'verified'])
    assert.equal(
      (await request('POST', '', { ...fields, [extra]: true })).status,
      400
    );
  assert.equal((await request('POST', '', fields, '')).status, 400);
  pass(
    'anonymous/spoofed identities and client-supplied ownership or visibility are rejected'
  );

  const key = randomUUID();
  const [created, replay] = await Promise.all([
    request('POST', '', fields, key),
    request('POST', '', fields, key),
  ]);
  assert.equal(created.status, 201);
  assert.deepEqual(replay, created);
  const id = created.json.id;
  assert.equal((await request('GET')).json.length, 1);
  const saved = (await request('GET', '/' + id)).json;
  assert.equal(saved.website, fields.website);
  assert.equal(saved.revision, 1);
  assert.equal(
    (await request('POST', '', { ...fields, name: 'Changed intent' }, key))
      .status,
    409
  );
  for (const [uid, tenant] of [
    ['DraftBob', 'default'],
    ['draftalice', 'default'],
    ['DraftAlice', 'other'],
  ]) {
    assert.deepEqual(
      (await request('GET', '', undefined, undefined, uid, tenant)).json,
      []
    );
    assert.equal(
      (await request('GET', '/' + id, undefined, undefined, uid, tenant))
        .status,
      404
    );
    assert.equal(
      (
        await request(
          'PUT',
          '/' + id,
          { ...fields, expectedRevision: 1 },
          undefined,
          uid,
          tenant
        )
      ).status,
      404
    );
    assert.equal(
      (
        await request(
          'DELETE',
          '/' + id,
          { expectedRevision: 1 },
          undefined,
          uid,
          tenant
        )
      ).status,
      404
    );
    assert.equal(
      (await request('POST', '', fields, key, uid, tenant)).status,
      201
    );
  }
  pass(
    'canonical create/read, concurrent identical retry, case/owner/tenant isolation and independent slug namespaces'
  );

  const changes = await Promise.all([
    request('PUT', '/' + id, {
      ...fields,
      name: 'First change',
      expectedRevision: 1,
    }),
    request('PUT', '/' + id, {
      ...fields,
      name: 'Second change',
      expectedRevision: 1,
    }),
  ]);
  assert.deepEqual(changes.map((item) => item.status).sort(), [200, 409]);
  assert.equal((await request('GET', '/' + id)).json.revision, 2);
  assert.equal(
    (await request('PUT', '/' + id, { ...fields, expectedRevision: 1 })).status,
    409
  );
  const slugRace = await Promise.all([
    request('POST', '', { ...fields, slug: 'same-slug' }),
    request('POST', '', { ...fields, slug: 'same-slug' }),
  ]);
  assert.deepEqual(slugRace.map((item) => item.status).sort(), [201, 409]);
  const duplicateId = slugRace.find((item) => item.status === 201).json.id;
  assert.equal(
    (
      await request('PUT', '/' + duplicateId, {
        ...fields,
        expectedRevision: 1,
      })
    ).status,
    409
  );
  pass(
    'competing revisions and owner slug races serialize without lost changes'
  );

  const beforeFailure = (await request('GET', '/' + id)).json;
  const rollbackKey = randomUUID();
  await source.query(
    "CREATE TRIGGER fail_application_draft_receipt BEFORE INSERT ON application_draft_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected receipt failure'"
  );
  try {
    assert.equal(
      (
        await request(
          'PUT',
          '/' + id,
          { ...fields, name: 'Must roll back', expectedRevision: 2 },
          rollbackKey
        )
      ).status,
      503
    );
    assert.equal(
      (await request('DELETE', '/' + id, { expectedRevision: 2 })).status,
      503
    );
    assert.deepEqual((await request('GET', '/' + id)).json, beforeFailure);
    assert.equal(
      (await request('POST', '', { ...fields, slug: 'rolled-back-create' }))
        .status,
      503
    );
    assert.equal(
      (
        await source.query('SELECT id FROM application_drafts WHERE slug = ?', [
          'rolled-back-create',
        ])
      ).length,
      0
    );
  } finally {
    await source.query('DROP TRIGGER fail_application_draft_receipt');
  }
  const recovered = await request(
    'PUT',
    '/' + id,
    { ...fields, name: 'Must roll back', expectedRevision: 2 },
    rollbackKey
  );
  assert.equal(recovered.status, 200);
  assert.equal(recovered.json.revision, 3);
  pass(
    'create/edit/delete and receipts roll back atomically; retry recovers the failed transaction'
  );

  const deleteKey = randomUUID();
  const removed = await request(
    'DELETE',
    '/' + id,
    { expectedRevision: 3 },
    deleteKey
  );
  assert.deepEqual(removed.json, { id, revision: 4, deleted: true });
  assert.deepEqual(
    await request('DELETE', '/' + id, { expectedRevision: 3 }, deleteKey),
    removed
  );
  assert.deepEqual(await request('POST', '', fields, key), created);
  assert.deepEqual(
    await request(
      'PUT',
      '/' + id,
      { ...fields, name: 'Must roll back', expectedRevision: 2 },
      rollbackKey
    ),
    recovered
  );
  assert.equal((await request('GET', '/' + id)).status, 404);
  const [tombstone] = await source.query(
    'SELECT * FROM application_drafts WHERE id = ?',
    [id]
  );
  for (const field of ['name', 'slug', 'website', 'description'])
    assert.equal(tombstone[field], '');
  assert.equal(Number(tombstone.revision), 4);
  assert.equal(Number(tombstone.deletedAt), Number(tombstone.updatedAt));
  assert.equal((await request('POST', '', fields)).status, 201);
  pass(
    'deletion scrubs payload, releases the private slug and old receipts cannot resurrect data'
  );

  for (let index = 0; index < 99; index++)
    assert.equal(
      (
        await request(
          'POST',
          '',
          { ...fields, slug: `capacity-${index}` },
          undefined,
          'DraftCapacity'
        )
      ).status,
      201
    );
  const capacity = await Promise.all(
    [100, 101].map((index) =>
      request(
        'POST',
        '',
        { ...fields, slug: `capacity-${index}` },
        undefined,
        'DraftCapacity'
      )
    )
  );
  assert.deepEqual(capacity.map((item) => item.status).sort(), [201, 409]);
  assert.equal(
    (await request('GET', '', undefined, undefined, 'DraftCapacity')).json
      .length,
    100
  );
  pass(
    'the 100-draft owner capacity remains bounded under competing final creates'
  );

  const runner = source.createQueryRunner();
  try {
    await new ApplicationDrafts1791676810000().up(runner);
    await source.query(
      'UPDATE application_drafts SET createdAt = ? WHERE id = ?',
      [Number.MAX_SAFE_INTEGER + 1, id]
    );
    await assert.rejects(new ApplicationDrafts1791676810000().up(runner));
    await source.query(
      'UPDATE application_drafts SET createdAt = ? WHERE id = ?',
      [tombstone.createdAt, id]
    );
    await source.query(
      'UPDATE application_draft_commands SET fingerprint = ? WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
      ['bad', 'default', 'DraftAlice', key]
    );
    await assert.rejects(
      new ApplicationDrafts1791676810000().up(runner),
      /receipt/
    );
    // A fingerprint is immutable; use the canonical normalized command to restore the deliberately corrupted fixture.
    const fingerprint = require('node:crypto')
      .createHash('sha256')
      .update(
        JSON.stringify({
          type: 'create',
          id: null,
          expectedRevision: null,
          fields,
        })
      )
      .digest('hex');
    await source.query(
      'UPDATE application_draft_commands SET fingerprint = ? WHERE tenantId = ? AND ownerIdentityId = ? AND commandKey = ?',
      [fingerprint, 'default', 'DraftAlice', key]
    );
    await new ApplicationDrafts1791676810000().up(runner);
  } finally {
    await runner.release();
  }
  pass(
    'additive migration reentry preserves data and rejects corrupt tombstones or receipts'
  );

  await restart();
  assert.deepEqual(await request('POST', '', fields, key), created);
  assert.equal((await request('GET', '/' + id)).status, 404);
  assert.equal(
    (await request('GET', '/' + duplicateId)).json.slug,
    'same-slug'
  );
  assert.equal(await count('app_records'), before.records);
  assert.equal(await count('editorial_resource_states'), before.states);
  assert.equal(await count('editorial_outbox'), before.outbox);
  assert.equal(
    (await fetch(origin() + '/api/catalog/apps/' + fields.slug)).status,
    404
  );
  const selection = await fetch(
    origin() + '/api/catalog/app-selection?ids=' + [id, duplicateId].join(',')
  );
  assert.equal(selection.status, 200);
  assert.deepEqual(await selection.json(), { items: [] });
  pass(
    'API restart preserves drafts, tombstones and retry receipts with no public records or projection intent'
  );

  if (browser)
    await require('./application-draft-browser.cjs').applicationDraftBrowser({
      root,
      source,
      origin,
      headers,
      restart,
      output,
    });
  const total = await count('application_drafts');
  await stopPolicy();
  assert.equal(
    (await request('POST', '', { ...fields, slug: 'policy-outage' })).status,
    503
  );
  assert.equal((await request('GET')).status, 503);
  assert.equal(await count('application_drafts'), total);
  pass('policy outage denies reads and writes without changing canonical data');
}
module.exports = { applicationDraftChecks };
