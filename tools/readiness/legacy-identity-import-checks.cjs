const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  planLegacyStubs,
  legacyEvidenceHash,
  importLegacyStubs,
  MysqlCanonicalIdentities,
} = require('@wapps/account-mysql');

/** Called only on the local-auth qualifier's fresh test-owned Identity schema. */
async function qualifyLegacyIdentityImport(source) {
  const identityId = randomUUID(),
    at = Date.now();
  const plan = planLegacyStubs({
    sourceDatabase: 'legacy_identity',
    capturedAt: at,
    subjects: [
      {
        id: 'external-mapping',
        provider: 'legacy-provider',
        externalId: 'external-subject',
        identityId,
        createdAt: at - 100,
        updatedAt: at - 100,
        deletedAt: 0,
      },
    ],
    nodes: [
      {
        _id: 'node-document',
        id: identityId,
        kind: 'identity',
        createdAt: at - 100,
        updatedAt: at - 100,
        deletedAt: 0,
      },
    ],
    accounts: [
      {
        _id: identityId,
        email: 'unverified-legacy@example.test',
        status: 'STUB',
        createdAt: at - 90,
        updatedAt: at - 90,
        deletedAt: 0,
      },
    ],
    profiles: [
      { _id: identityId, createdAt: at - 90, updatedAt: at - 90, deletedAt: 0 },
    ],
  });
  const approvedHash = legacyEvidenceHash(plan);
  await assert.rejects(
    () => importLegacyStubs(source, plan, '0'.repeat(64)),
    /hash does not match/
  );
  const sameSource = { ...plan, sourceDatabase: source.options.database };
  await assert.rejects(
    () => importLegacyStubs(source, sameSource, legacyEvidenceHash(sameSource)),
    /separate staging/
  );
  await source.query(
    "CREATE TRIGGER fail_legacy_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected legacy rollback'"
  );
  await assert.rejects(
    () => importLegacyStubs(source, plan, approvedHash),
    /injected legacy rollback/
  );
  await source.query('DROP TRIGGER fail_legacy_outbox');
  for (const table of [
    'identities',
    'identity_events_outbox',
    'identity_legacy_imports',
  ])
    assert.equal((await source.query(`SELECT * FROM ${table}`)).length, 0);
  const results = await Promise.all([
    importLegacyStubs(source, plan, approvedHash),
    importLegacyStubs(source, plan, approvedHash),
  ]);
  assert.deepEqual(results.map((r) => r.replayed).sort(), [false, true]);
  const identities = new MysqlCanonicalIdentities(source),
    state = await identities.find(identityId);
  assert.equal(state.identityId, identityId);
  assert.equal(state.subjectId, identityId);
  assert.equal(state.createdAt, at - 100);
  assert.equal(state.isActive, false);
  assert.equal(state.isSuspended, true);
  await assert.rejects(() => identities.getProfile(identityId));
  await assert.rejects(
    () => identities.credentialSubjects(identityId),
    /Verified credential bindings required/
  );
  assert.deepEqual(
    await source.query(
      'SELECT * FROM identity_credential_bindings WHERE identityId = ?',
      [identityId]
    ),
    []
  );
  const [event] = await source.query(
    'SELECT body FROM identity_events_outbox WHERE identityId = ?',
    [identityId]
  );
  assert.equal(JSON.parse(event.body).payload.state.isActive, false);
  const altered = structuredClone(plan);
  altered.identities[0].sourceHash = 'b'.repeat(64);
  altered.sourceHash = legacyEvidenceHash(altered.identities);
  await assert.rejects(
    () => importLegacyStubs(source, altered, legacyEvidenceHash(altered)),
    /different legacy import/
  );
  // An idempotent replay cannot reset a later canonical lifecycle change.
  await identities.setSuspended(identityId, false);
  const updated = await identities.find(identityId);
  await importLegacyStubs(source, plan, approvedHash);
  assert.deepEqual(await identities.find(identityId), updated);
  assert.equal(updated.isActive, false);
  console.log(
    'PASS staged legacy import: stable identity/public ID, restricted access, no credential linking, atomic outbox/receipt rollback, concurrent replay and preservation of later state'
  );
  return { identityId, plan, approvedHash };
}
module.exports = { qualifyLegacyIdentityImport };
