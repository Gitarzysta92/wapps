/* Exercises only a random account in the localhost Firebase Auth emulator; sends no external mail. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const config = path.join(root, 'tsconfig.base.json');
require('ts-node').register({
  project: config,
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
require('tsconfig-paths').register({
  baseUrl: root,
  paths: ts.readConfigFile(config, ts.sys.readFile).config.compilerOptions
    .paths,
});
const {
  FirebaseRestSessionGateway,
  FirebasePasswordRecovery,
  FirebasePasswordReset,
  FirebaseEmailVerification,
} = require('../../sdk/features/identity/packages/infrastructure/firebase/src');

test(
  'Firebase emulator signup, verification, recovery, action type isolation and replay rejection',
  { timeout: 60000 },
  async () => {
    assert.equal(
      process.env.WAPPS_CREDENTIAL_INTEGRATION,
      '1',
      'Set WAPPS_CREDENTIAL_INTEGRATION=1 with the localhost emulator running; unavailable checks are not passes.'
    );
    const port = Number(process.env.IDENTITY_TEST_FIREBASE_PORT ?? 9099);
    assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
    const host = `127.0.0.1:${port}`;
    const email = `identity-${randomUUID()}@example.test`;
    const project = process.env.IDENTITY_TEST_FIREBASE_PROJECT ?? 'demo-wapps';
    assert.match(project, /^[a-zA-Z0-9-]{1,100}$/);
    const gateway = new FirebaseRestSessionGateway(project, host);
    const recovery = new FirebasePasswordRecovery(project, host);
    const reset = new FirebasePasswordReset(project, host);
    const verification = new FirebaseEmailVerification(project, host);
    async function actionCode(type) {
      const response = await fetch(
        `http://${host}/emulator/v1/projects/${project}/oobCodes`,
        { signal: AbortSignal.timeout(10000) }
      );
      assert.equal(response.ok, true);
      const body = await response.json();
      const found = body.oobCodes.find(
        (value) => value.email === email && value.requestType === type
      );
      assert.ok(found, `Provider must create a ${type} action`);
      return found.oobCode;
    }
    const requireSession = (result) => {
      assert.equal(result.ok, true, 'Emulator session request must succeed');
      return result.value;
    };
    let session;
    try {
      session = requireSession(
        await gateway.registerOrAuthenticate(email, 'First-password-123')
      );
      assert.equal(
        JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url')).aud,
        project,
        'Use the project configured in the localhost emulator'
      );
      assert.equal(
        requireSession(
          await gateway.registerOrAuthenticate(email, 'First-password-123')
        ).uid,
        session.uid
      );
      assert.equal(
        (await gateway.registerOrAuthenticate(email, 'Wrong-password-456')).ok,
        false
      );
      assert.deepEqual(await verification.status(session), {
        email,
        verified: false,
      });
      await assert.rejects(
        verification.status({ ...session, uid: 'not-this-account' })
      );
      assert.equal(await verification.request(session), 'requested');
      const verifyCode = await actionCode('VERIFY_EMAIL');
      await assert.rejects(reset.verify(verifyCode));
      await assert.rejects(
        reset.complete(verifyCode, 'Unintended-password-789')
      );
      await verification.verify(verifyCode);
      await verification.complete(verifyCode);
      assert.deepEqual(await verification.status(session), {
        email,
        verified: true,
      });
      assert.equal(await verification.request(session), 'already-verified');
      await assert.rejects(verification.complete(verifyCode));
      await recovery.send(email);
      const response = await fetch(
        `http://${host}/emulator/v1/projects/${project}/oobCodes`,
        { signal: AbortSignal.timeout(10000) }
      );
      assert.equal(response.ok, true);
      const codes = await response.json();
      const code = codes.oobCodes.find(
        (value) =>
          value.email === email && value.requestType === 'PASSWORD_RESET'
      );
      assert.ok(code, 'Provider delivery must create a reset action code');
      await assert.rejects(verification.verify(code.oobCode));
      await assert.rejects(verification.complete(code.oobCode));
      await reset.verify(code.oobCode);
      await reset.complete(code.oobCode, 'Second-password-456');
      await assert.rejects(reset.complete(code.oobCode, 'Third-password-789'));
      assert.equal(
        (await gateway.signInWithPassword(email, 'First-password-123')).ok,
        false
      );
      session = requireSession(
        await gateway.signInWithPassword(email, 'Second-password-456')
      );
      await require('./account-export-credential-checks.cjs').qualifyCredentialExport({ host, project, uid: session.uid, email });
    } finally {
      if (session) {
        const deleted = await fetch(
          `http://${host}/identitytoolkit.googleapis.com/v1/accounts:delete?key=${project}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: session.token }),
            signal: AbortSignal.timeout(10000),
          }
        );
        assert.equal(
          deleted.ok,
          true,
          'Remove only the disposable qualification account'
        );
      }
    }
  }
);
