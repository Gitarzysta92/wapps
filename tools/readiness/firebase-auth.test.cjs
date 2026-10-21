/* Uses only fresh test-owned MySQL and Firebase emulator containers. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const { createServer } = require('node:net');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
require('ts-node').register({
  project: path.join(root, 'tsconfig.base.json'),
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
require('tsconfig-paths').register({
  baseUrl: root,
  paths: ts.readConfigFile(
    path.join(root, 'tsconfig.base.json'),
    ts.sys.readFile
  ).config.compilerOptions.paths,
});
require('reflect-metadata');
const admin = require('firebase-admin');
const {
  credentialDataSource,
} = require('../../sdk/features/identity/applications/authenticator/service/src/credential-data-source');
const { processService } = require('./qualification-process.cjs');
const execute = promisify(execFile);

test(
  'Firebase credentials through the compiled independent Authentication service',
  { timeout: 180000 },
  async () => {
    assert.equal(
      process.env.WAPPS_FIREBASE_AUTH_INTEGRATION,
      '1',
      'Set WAPPS_FIREBASE_AUTH_INTEGRATION=1; Docker and the compiled authenticator are required'
    );
    const id = randomUUID().replaceAll('-', ''),
      password = randomUUID(),
      secret = id + id;
    const names = [];
    const directory = mkdtempSync(
      path.join(tmpdir(), 'wapps-firebase-config-')
    );
    writeFileSync(
      path.join(directory, 'generated.json'),
      JSON.stringify({ authenticationMysql: password }),
      { mode: 0o600 }
    );
    let source, service, app;
    const docker = (args) =>
      execute('docker', args, { timeout: 30000, maxBuffer: 65536 });
    async function container(kind, image, port, env) {
      const name = `wapps-firebase-qualification-${kind}-${id}`;
      await docker([
        'run',
        '-d',
        '--pull=never',
        '--name',
        name,
        '-p',
        `127.0.0.1::${port}`,
        ...env.flatMap((value) => ['-e', value]),
        image,
      ]);
      names.push(name);
      const result = await docker([
        'inspect',
        '--format',
        `{{(index (index .NetworkSettings.Ports "${port}/tcp") 0).HostPort}}`,
        name,
      ]);
      return Number(result.stdout.trim());
    }
    try {
      const mysqlPort = await container('mysql', 'mysql:8.4', 3306, [
        `MYSQL_ROOT_PASSWORD=${password}`,
        'MYSQL_DATABASE=authentication',
      ]);
      const firebasePort = await container(
        'firebase',
        'wapps-local-firebase-auth:latest',
        9099,
        []
      );
      const server = createServer();
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      await new Promise((resolve) => server.close(resolve));
      const env = {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(port),
        MYSQL_HOST: '127.0.0.1',
        MYSQL_PORT: String(mysqlPort),
        MYSQL_USERNAME: 'wapps_auth',
        MYSQL_PASSWORD: password,
        MYSQL_DATABASE: 'authentication',
        AUTH_PROVIDER: 'firebase',
        AUTH_ISSUER: 'firebase:demo-wapps',
        AUTH_SERVICE_SECRET: secret,
        FIREBASE_PROJECT_ID: 'demo-wapps',
        FIREBASE_WEB_API_KEY: 'demo-wapps',
        FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${firebasePort}`,
        GOOGLE_APPLICATION_CREDENTIALS: '',
        ENABLE_GOOGLE: 'false',
        ENABLE_GITHUB: 'false',
        ENABLE_ANONYMOUS: 'false',
      };
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          await docker([
            'exec',
            names[0],
            'sh',
            '-c',
            'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "SELECT 1"',
          ]);
          break;
        } catch (error) {
          if (attempt === 99) throw error;
          await delay(500);
        }
      }
      const provision = [
        '-B',
        path.join(root, 'deploy/alpha/provision-authentication.py'),
        '--directory',
        directory,
        '--container',
        names[0],
      ];
      await execute('python3', provision);
      await execute('python3', [...provision, '--apply']);
      await execute('python3', [...provision, '--apply']);
      writeFileSync(
        path.join(directory, 'generated.json'),
        JSON.stringify({ authenticationMysql: randomUUID() }),
        { mode: 0o600 }
      );
      await assert.rejects(
        execute('python3', [...provision, '--apply']),
        /credential does not match/
      );
      writeFileSync(
        path.join(directory, 'generated.json'),
        JSON.stringify({ authenticationMysql: password }),
        { mode: 0o600 }
      );
      source = credentialDataSource(env);
      await source.initialize();
      await source.runMigrations();
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          await fetch(`http://127.0.0.1:${firebasePort}/`, {
            signal: AbortSignal.timeout(500),
          });
          break;
        } catch (error) {
          if (attempt === 99) throw error;
          await delay(500);
        }
      }
      const start = () =>
        processService(
          process.execPath,
          [
            path.join(
              root,
              'dist/sdk/features/identity/applications/authenticator/main.js'
            ),
          ],
          { cwd: root, env },
          () => `http://127.0.0.1:${port}`,
          '/health'
        );
      service = await start();
      async function request(operation, body, status = 200) {
        const response = await fetch(
          `${service.origin}/credentials/${operation}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Credential-Service': secret,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20000),
          }
        );
        assert.equal(response.status, status, `${operation} status`);
        const value = await response.json();
        assert.equal(value.issuer, env.AUTH_ISSUER);
        return value.value;
      }
      const registration = {
        email: 'new@example.test',
        password: 'password123',
        key: id,
      };
      const [first, concurrent] = await Promise.all([
        request('registration', registration),
        request('registration', registration),
      ]);
      assert.equal(first.enrollmentEligible, true);
      assert.equal(concurrent.subject, first.subject);
      assert.equal(concurrent.enrollmentEligible, true);
      assert.equal(
        (await request('verify-token', { token: first.token })).subject,
        first.subject
      );
      await service.stop();
      service = await start();
      const retried = await request('registration', registration);
      assert.equal(retried.subject, first.subject);
      assert.equal(retried.enrollmentEligible, true);
      assert.equal(
        (await request('registration', { ...registration, key: 'different' }))
          .enrollmentEligible,
        false
      );
      await request(
        'registration',
        { ...registration, password: 'wrong-password' },
        401
      );
      assert.equal(
        (await request('refresh', { refreshToken: first.refreshToken }))
          .subject,
        first.subject
      );
      const rows = await source.query(
        'SELECT COUNT(*) AS total FROM firebase_credential_enrollments WHERE created = 1'
      );
      assert.equal(Number(rows[0].total), 1);

      process.env.FIREBASE_AUTH_EMULATOR_HOST = env.FIREBASE_AUTH_EMULATOR_HOST;
      app = admin.initializeApp({ projectId: 'demo-wapps' }, id);
      await app.auth().createUser({
        uid: 'pre-existing',
        email: 'old@example.test',
        password: 'password123',
      });
      const old = await request('registration', {
        ...registration,
        email: 'old@example.test',
      });
      assert.equal(old.subject, 'pre-existing');
      assert.equal(old.enrollmentEligible, false);
      await request('delete', { subject: first.subject });
      await request('registration', registration, 401);
      console.log(
        'PASS real SQL receipt, concurrent signup, exact subject, restart, retry-key isolation, password verification, refresh, pre-existing credential denial and deletion'
      );
    } finally {
      if (service) await service.stop();
      if (source?.isInitialized) await source.destroy();
      if (app) await app.delete();
      for (const name of names.reverse()) await docker(['rm', '-f', name]);
      rmSync(directory, { recursive: true, force: true });
    }
  }
);
