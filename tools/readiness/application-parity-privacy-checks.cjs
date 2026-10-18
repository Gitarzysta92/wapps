const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

module.exports = async function ownershipPrivacy({
  call,
  local,
  services,
  maintainer,
  successor,
  staff,
  reviewer,
  id,
  claimInput,
  proposed,
  publicPath,
  claims,
  base,
  request,
  change,
  claimRead,
  claimChange,
  ownDecision,
  source,
  open,
  submit,
  decision,
  projected,
}) {
  async function acquire(actor) {
    const claim = await change(claims, actor, claimInput);
    const challenge = await claimRead(claim.id, actor);
    services.dns.records.set(challenge.challengeName, challenge.challengeValue);
    await claimChange(claim.id, 'verify', 1, actor);
    await ownDecision(claim.id, 2, 'approve', staff);
    return claim;
  }
  const erasedClaim = await acquire(maintainer);
  const draft = await open(await source(id, maintainer), maintainer);
  await submit(draft.id, 1, maintainer);
  const before = await projected(id, 7);
  assert.deepEqual((await source(id, maintainer)).fields, proposed);
  const accepted = await call('/api/me', {
    at: local,
    token: maintainer.token,
    method: 'DELETE',
    status: 202,
  });
  assert.equal(accepted.cleanup, 'pending');
  await call(`${base}/canonical/${id}`, {
    at: local,
    token: maintainer.token,
    status: 401,
  });
  const internal =
    services.endpoints.EDITORIAL_URL + '/api/internal/account-erasure';
  const body = { identityId: maintainer.uid, revision: accepted.revision };
  async function erase(value = body, statuses = [200, 202]) {
    const response = await fetch(internal, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Account-Erasure-Writer': services.environment.ACCOUNT_ERASURE_SECRET,
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(15000),
    });
    const receipt = await response.json();
    assert.ok(statuses.includes(response.status), JSON.stringify(receipt));
    return receipt;
  }
  const pending = await erase(body, [202]);
  assert.equal(pending.state, 'pending');
  assert.deepEqual(await erase(body, [202]), pending);
  await erase({ ...body, revision: body.revision + 1 }, [409]);
  // This participant's own worker is stopped before enabling its disposable erasure fence.
  // The full Account provider saga and deployment fencing belong to A28.
  await services.stopWorker();
  await services.restartEditorial({ EDITORIAL_ERASURE_WORKERS_FENCED: 'true' });
  let receipt;
  for (let attempt = 0; attempt < 100; attempt++) {
    receipt = await erase();
    if (receipt.state === 'completed') break;
    await delay(25);
  }
  assert.equal(receipt.state, 'completed', JSON.stringify(receipt));
  assert.deepEqual(await erase(), receipt);
  const {
    EDITORIAL_ERASURE_IDENTITY_COLUMNS,
  } = require('../../apps/services/editorial/src/app/account-erasure/mysql-editorial-erasure-completion');
  for (const [table, column] of EDITORIAL_ERASURE_IDENTITY_COLUMNS) {
    const [row] = await services.sql.query(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`,
      [maintainer.uid]
    );
    assert.equal(Number(row.n), 0, `${table}.${column} retains erased owner`);
  }
  assert.equal(
    (
      await services.sql.query(
        'SELECT * FROM application_ownership_claims WHERE id=?',
        [erasedClaim.id]
      )
    ).length,
    0
  );
  assert.equal(
    (
      await services.sql.query('SELECT * FROM application_drafts WHERE id=?', [
        draft.id,
      ])
    ).length,
    0
  );
  const [history] = await services.sql.query(
    'SELECT * FROM application_ownership_history WHERE applicationId=?',
    [id]
  );
  assert.ok(history, 'Permanent ownership fence must survive private erasure');
  const anonymized = await request(publicPath, { cache: 'no-store' });
  for (const field of [
    'name',
    'slug',
    'website',
    'description',
    'classification',
    'logoUrl',
  ])
    assert.deepEqual(anonymized[field], before[field]);
  await services.restartEditorial();
  assert.deepEqual(await erase(), receipt);
  await services.startWorker();
  console.log(
    'PASS canonical account deletion immediately denies the former session; existing Editorial erasure participant drains ownership/private provenance and retains anonymous approved content/media across restart; full Account erasure remains separate'
  );

  const newClaim = await acquire(successor);
  assert.notEqual(newClaim.id, erasedClaim.id);
  const canonical = await source(id, successor);
  assert.equal(canonical.claimId, newClaim.id);
  assert.deepEqual(canonical.fields, proposed);
  assert.deepEqual(await request(base, { actor: successor }), []);
  await request(`${base}/${draft.id}`, { actor: successor, status: 404 });
  await claimRead(erasedClaim.id, successor, { status: 404 });
  await ownDecision(erasedClaim.id, 2, 'approve', staff, { status: 404 });
  const editKey = randomUUID();
  const edit = await open(canonical, successor, { key: editKey });
  await submit(edit.id, 1, successor);
  const key = randomUUID();
  const approvalBody = { expectedRevision: 2, submittedRevision: 1 };
  const approved = await decision(edit.id, approvalBody, reviewer, { key });
  await projected(id, approved.publicationRevision);
  await services.stopWorker();
  const stale = await services.projections.findOne({
    kind: 'app',
    resourceId: id,
  });
  await change(
    `${base}/${edit.id}/withdraw`,
    maintainer,
    { expectedRevision: 3 },
    { status: 401, cache: null }
  );
  const withdrawalKey = randomUUID();
  const withdrawn = await change(
    `${base}/${edit.id}/withdraw`,
    successor,
    { expectedRevision: 3 },
    { key: withdrawalKey }
  );
  await request(publicPath, { status: 404, cache: 'no-store' });
  assert.deepEqual(
    await services.projections.findOne({ kind: 'app', resourceId: id }),
    stale
  );
  await services.restartEditorial();
  assert.deepEqual(
    await change(
      `${base}/${edit.id}/withdraw`,
      successor,
      { expectedRevision: 3 },
      { key: withdrawalKey }
    ),
    withdrawn
  );
  assert.deepEqual(
    await decision(edit.id, approvalBody, reviewer, { key }),
    approved
  );
  assert.deepEqual(await open(canonical, successor, { key: editKey }), edit);
  await request(publicPath, { status: 404, cache: 'no-store' });
  assert.equal(
    (
      await services.sql.query(
        'SELECT * FROM application_ownership_claims WHERE id=?',
        [erasedClaim.id]
      )
    ).length,
    0
  );
  console.log(
    'PASS successor acquires a new independently approved claim from retained canonical content, receives no erased private history, and explicit withdrawal/replay cannot revive prior grants or publication'
  );
};
