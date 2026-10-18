const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

module.exports = async function suitePrivacy({
  call,
  local,
  privacy,
  owner,
  reviewer,
  fields,
  services,
  request,
  change,
  submit,
  decision,
  projected,
}) {
  const base = '/api/me/suites';
  const publishedDraft = await change(base, privacy, {
    ...fields,
    title: 'Retained privacy suite',
  });
  const privateDraft = await change(base, privacy, {
    ...fields,
    title: 'Private export suite',
    classification: 'mature',
  });
  await submit(publishedDraft.id, 1, privacy);
  await decision(
    publishedDraft.id,
    { expectedRevision: 2, submittedRevision: 1 },
    reviewer
  );
  const published = await projected(publishedDraft.id);
  const internal = services.endpoints.EDITORIAL_URL + '/api/internal/';
  const exportHeaders = {
    'Content-Type': 'application/json',
    'X-Account-Export-Reader':
      services.environment.ACCOUNT_EXPORT_SOURCE_SECRET,
  };
  async function capture(identityId, headers = exportHeaders, expected = 200) {
    const response = await fetch(internal + 'account-export', {
      method: 'POST',
      headers,
      body: JSON.stringify({ identityId }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, expected);
    const text = await response.text();
    if (expected !== 200) return [];
    assert.match(
      response.headers.get('content-type'),
      /^application\/x-ndjson/
    );
    const entries = text.trim().split('\n').map(JSON.parse);
    assert.equal(entries[0].type, 'begin');
    assert.equal(entries.at(-1).type, 'end');
    assert.equal(
      entries.at(-1).records,
      entries.filter((entry) => entry.type === 'record').length
    );
    return entries;
  }
  await capture(
    privacy.uid,
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${privacy.token}`,
    },
    401
  );
  const before = await capture(privacy.uid);
  const records = before.filter(
    (entry) => entry.collection === 'suites.drafts'
  );
  assert.deepEqual(
    records.map((entry) => entry.data.id).sort(),
    [privateDraft.id, publishedDraft.id].sort()
  );
  assert.equal(
    records.find((entry) => entry.data.id === privateDraft.id).data.content
      .classification,
    'mature'
  );
  const publicRecord = before.find(
    (entry) => entry.collection === 'suites.publications'
  );
  assert.equal(publicRecord.data.content.title, published.title);
  assert.equal(publicRecord.data.content.classification, 'general');
  const foreign = await capture(owner.uid);
  assert.ok(!JSON.stringify(foreign).includes(privateDraft.id));
  await change(
    `${base}/${publishedDraft.id}`,
    privacy,
    { expectedRevision: 3 },
    {
      method: 'DELETE',
      status: 200,
      key: randomUUID(),
    }
  );
  const afterRemoval = await capture(privacy.uid);
  assert.equal(
    afterRemoval.find(
      (entry) =>
        entry.collection === 'suites.drafts' &&
        entry.data.id === publishedDraft.id
    ).data.content,
    null
  );
  assert.deepEqual(
    afterRemoval.find((entry) => entry.collection === 'suites.publications'),
    publicRecord
  );
  assert.deepEqual(
    await request('/api/catalog/suites/' + publishedDraft.id),
    published
  );
  console.log(
    'PASS existing Editorial export hook streams exact owner-private suites, classifications and independent approved snapshots after private removal, with complete source framing and credential isolation'
  );

  const accepted = await call('/api/me', {
    at: local,
    token: privacy.token,
    method: 'DELETE',
    status: 202,
  });
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.cleanup, 'pending');
  await call(base, { at: local, token: privacy.token, status: 401 });
  const erasure = { identityId: privacy.uid, revision: accepted.revision };
  async function erase(body = erasure, expected = [200, 202]) {
    const response = await fetch(internal + 'account-erasure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Account-Erasure-Writer': services.environment.ACCOUNT_ERASURE_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    assert.ok(
      expected.includes(response.status),
      `Editorial suite erasure HTTP ${response.status}: ${JSON.stringify(
        result
      )}`
    );
    return result;
  }
  const pending = await erase(erasure, [202]);
  assert.equal(pending.state, 'pending');
  assert.deepEqual(await erase(erasure, [202]), pending);
  await erase({ ...erasure, revision: erasure.revision + 1 }, [409]);
  assert.deepEqual(
    await request('/api/catalog/suites/' + publishedDraft.id),
    published
  );
  // Only this participant runs in its disposable store; Account's complete provider saga remains separate.
  await services.stopWorker();
  await services.restartEditorial({ EDITORIAL_ERASURE_WORKERS_FENCED: 'true' });
  let receipt;
  for (let attempt = 0; attempt < 100; attempt++) {
    receipt = await erase();
    if (receipt.state === 'completed') break;
    await delay(25);
  }
  assert.equal(
    receipt.state,
    'completed',
    'Editorial suite privacy participant did not converge'
  );
  assert.deepEqual(await erase(), receipt);
  const {
    EDITORIAL_ERASURE_IDENTITY_COLUMNS,
  } = require('../../apps/services/editorial/src/app/account-erasure/mysql-editorial-erasure-completion');
  for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS) {
    const rows = await services.sql.query(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`,
      [privacy.uid]
    );
    assert.equal(
      Number(rows[0].n),
      0,
      `${table}.${column} retains erased suite owner`
    );
  }
  const anonymousPublication = await request(
    '/api/catalog/suites/' + publishedDraft.id
  );
  assert.deepEqual(anonymousPublication, {
    ...published,
    revision: published.revision + 1,
  });
  assert.equal(
    (await capture(privacy.uid)).filter((entry) => entry.type === 'record')
      .length,
    0
  );
  await services.restartEditorial();
  assert.deepEqual(await erase(), receipt);
  assert.deepEqual(
    await request('/api/catalog/suites/' + publishedDraft.id),
    anonymousPublication
  );
  console.log(
    'PASS canonical self-deletion denies suite sessions; the real Editorial participant preserves anonymous approved content and drains private suite provenance with exact replay/restart, without claiming full cross-service account erasure'
  );
};
