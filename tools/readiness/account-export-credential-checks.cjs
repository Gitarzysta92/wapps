const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const admin = require('firebase-admin');
const { FirebaseAccountExportSource } = require('../../sdk/features/identity/packages/infrastructure/firebase/src');

async function collect(iterable) { const values = []; for await (const value of iterable) values.push(value); return values; }
async function qualifyCredentialExport({ host, project, uid, email }) {
  assert.match(host, /^127\.0\.0\.1:\d+$/);
  const previous = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = host;
  const app = admin.initializeApp({ projectId: project }, `account-export-${randomUUID()}`);
  const auth = app.auth();
  try {
    await auth.setCustomUserClaims(uid, { internalQualificationSecret: 'never-export-internal-claims', admin: true });
    await auth.updateUser(uid, { displayName: 'Credential export member', phoneNumber: '+15555550123' });
    const reader = new FirebaseAccountExportSource(() => auth);
    const captured = await collect(reader.capture(uid, new AbortController().signal));
    assert.equal(captured[0].type, 'begin');
    const member = captured.find(row => row.collection === 'credential-user').data;
    assert.equal(member.uid, uid);
    assert.equal(member.email, email);
    assert.equal(member.emailVerified, true);
    assert.equal(member.displayName, 'Credential export member');
    assert.equal(member.phoneNumber, '+15555550123');
    assert.ok(member.createdAt && member.lastSignInAt);
    assert.ok(captured.some(row => row.collection === 'linked-provider' && row.data.providerId === 'password'));
    assert.equal(captured.at(-1).records, captured.filter(row => row.type === 'record').length);
    for (const forbidden of ['passwordHash', 'passwordSalt', 'customClaims', 'never-export-internal-claims', 'refreshToken', 'idToken']) assert.equal(JSON.stringify(captured).includes(forbidden), false, forbidden);
    await assert.rejects(collect(reader.capture(`missing-${randomUUID()}`, new AbortController().signal)), /Credential account is unavailable/);
    await auth.updateUser(uid, { disabled: true });
    try { await assert.rejects(collect(reader.capture(uid, new AbortController().signal)), /Credential account is unavailable/); }
    finally { await auth.updateUser(uid, { disabled: false }); }
    console.log('Real Firebase emulator account export passed: owner profile, provider metadata, timestamps, missing/disabled credentials and exclusion of password/token/internal-claim fields. No external provider or email is contacted.');
  } finally {
    await app.delete();
    if (previous === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = previous;
  }
}
module.exports = { qualifyCredentialExport };
