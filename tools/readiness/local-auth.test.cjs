/* Explicit integration qualification: only fresh, test-owned Docker stores are mutated. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, randomInt, createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { createServer } = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const execute = promisify(execFile);
const root = path.resolve(__dirname, '../..');
const ts = require('typescript');
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
const { createConnection } = require('mysql2/promise');
const {
  identityDataSource,
  MysqlCanonicalIdentities,
  MysqlAccountExportSource,
} = require('@wapps/account-mysql');
const { MysqlLocalCredentials } = require('@sdk/extras/identity-local');
const {
  credentialDataSource,
  assertCredentialDatabase,
} = require('../../sdk/features/identity/applications/authenticator/service/src/credential-data-source');
const {
  RemoteCredentials,
} = require('../../sdk/features/identity/applications/management/service/src/app/authentication/remote-credentials');
const { processService } = require('./qualification-process.cjs');
const {
  qualifyLegacyIdentityImport,
} = require('./legacy-identity-import-checks.cjs');
const {
  qualifyAccountAdmin,
} = require('./bff-account-admin-runtime-checks.cjs');
const {
  qualifyAccountSettings,
} = require('./bff-account-settings-runtime-checks.cjs');

test(
  'local credentials through production BFF, authenticator, account and ingress',
  {
    timeout:
      process.env.WAPPS_PUBLIC_PROFILES_INTEGRATION === '1' ||
      process.env.WAPPS_MEMBER_PARITY_INTEGRATION === '1' ||
      process.env.WAPPS_EXPORT_PARITY_INTEGRATION === '1' ||
      process.env.WAPPS_SUITE_PARITY_INTEGRATION === '1'
        ? 480000
        : 240000,
  },
  async () => {
    assert.equal(
      process.env.WAPPS_LOCAL_AUTH_INTEGRATION,
      '1',
      'Set WAPPS_LOCAL_AUTH_INTEGRATION=1; this check requires Docker and built services'
    );
    assert.ok(
      [
        'WAPPS_PUBLIC_PROFILES_INTEGRATION',
        'WAPPS_MEMBER_PARITY_INTEGRATION',
        'WAPPS_EXPORT_PARITY_INTEGRATION',
        'WAPPS_SUITE_PARITY_INTEGRATION',
      ].filter((name) => process.env[name] === '1').length <= 1,
      'Run profile, member, export and suite extensions separately'
    );
    const id = randomUUID().replaceAll('-', ''),
      password = randomUUID();
    const names = [],
      processes = [];
    const allocatedPorts = new Set();
    const mysqlImage = `wapps-auth-qualification-mysql:${id}`;
    let mysqlImageBuilt = false;
    const directory = mkdtempSync(
      path.join(tmpdir(), 'wapps-local-auth-ingress-')
    );
    let source, credentialSource, nativeIngress;
    const docker = (args) =>
      execute('docker', args, { timeout: 30000, maxBuffer: 65536 });
    async function container(kind, image, port, args = [], command = []) {
      const name = `wapps-auth-qualification-${kind}-${id}`;
      await docker([
        'run',
        '--detach',
        '--pull=never',
        '--name',
        name,
        '--publish',
        `127.0.0.1:${await freePort()}:${port}`,
        ...args,
        image,
        ...command,
      ]);
      names.push(name);
      const { stdout } = await docker([
        'inspect',
        '--format',
        `{{(index (index .NetworkSettings.Ports "${port}/tcp") 0).HostPort}}`,
        name,
      ]);
      return Number(stdout.trim());
    }
    async function freePort() {
      // Keep test listeners out of the host's ephemeral client-port range.
      for (let attempt = 0; attempt < 100; attempt++) {
        const port = randomInt(20000, 30000);
        if (allocatedPorts.has(port)) continue;
        const server = createServer();
        try {
          await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, '0.0.0.0', resolve);
          });
          await new Promise((resolve) => server.close(resolve));
          allocatedPorts.add(port);
          return port;
        } catch (error) {
          if (error.code !== 'EADDRINUSE') throw error;
        }
      }
      throw new Error('No free qualification listener port');
    }
    async function start(bundle, env, port, health) {
      const service = await processService(
        process.execPath,
        [path.join(root, 'dist', bundle, 'main.js')],
        { cwd: root, env },
        () => `http://127.0.0.1:${port}`,
        health
      );
      processes.push(service);
      return service;
    }
    try {
      await docker([
        'build',
        '--pull=false',
        '--network=none',
        '--tag',
        mysqlImage,
        path.join(root, 'deploy/local/mysql'),
      ]);
      mysqlImageBuilt = true;
      const sqlPort = await container(
        'mysql',
        mysqlImage,
        3306,
        [
          '--env',
          `MYSQL_ROOT_PASSWORD=${password}`,
          '--env',
          'MYSQL_DATABASE=identity',
          '--env',
          `AUTHENTICATION_DB_PASSWORD=${password}`,
          '--env',
          'MYSQL_USER=wapps',
          '--env',
          `MYSQL_PASSWORD=${password}`,
        ],
        ['--log-bin-trust-function-creators=ON']
      );
      const queuePort = await container(
        'rabbit',
        'rabbitmq:4-management',
        5672,
        [
          '--env',
          'RABBITMQ_DEFAULT_USER=wapps',
          '--env',
          `RABBITMQ_DEFAULT_PASS=${password}`,
        ]
      );
      const policyPort = await container(
        'opa',
        'openpolicyagent/opa:1.4.2-static',
        8181,
        [
          '--mount',
          `type=bind,source=${path.join(
            root,
            'sdk/features/identity/packages/infrastructure/opa/bundles/identity-admin'
          )},target=/policies,readonly`,
        ],
        ['run', '--server', '--addr=0.0.0.0:8181', '/policies']
      );
      const policyContainer = names.at(-1);
      for (let attempt = 0; ; attempt++) {
        try {
          const connection = await createConnection({
            host: '127.0.0.1',
            port: sqlPort,
            user: 'wapps',
            password,
            database: 'identity',
            connectTimeout: 500,
          });
          await connection.end();
          break;
        } catch (error) {
          if (attempt >= 100) {
            const logs = await docker(['logs', names[0]]);
            console.error(
              (logs.stdout + logs.stderr)
                .replaceAll(password, '[redacted]')
                .slice(-6000)
            );
            throw error;
          }
          await delay(300);
        }
      }
      const authPort = await freePort(),
        accountPort = await freePort(),
        bffPort = await freePort();
      const env = {
        ...process.env,
        NODE_ENV: 'development',
        AUTH_PROVIDER: 'local',
        AUTH_ISSUER: 'qualification-local',
        AUTH_SERVICE_SECRET: `credential-${id}`,
        FIREBASE_PROJECT_ID: '',
        FIREBASE_WEB_API_KEY: '',
        FIREBASE_AUTH_EMULATOR_HOST: '',
        MYSQL_HOST: '127.0.0.1',
        MYSQL_PORT: String(sqlPort),
        MYSQL_DATABASE: 'identity',
        MYSQL_USERNAME: 'wapps',
        MYSQL_PASSWORD: password,
        QUEUE_HOST: '127.0.0.1',
        QUEUE_PORT: String(queuePort),
        QUEUE_USERNAME: 'wapps',
        QUEUE_PASSWORD: password,
        INGRESS_AUTH_SECRET: `ingress-${id}`,
        ACCOUNT_EXPORT_SOURCE_SECRET: `export-${id}`,
        ACCOUNT_ERASURE_SECRET: `erasure-${id}`,
        NOTIFICATION_SERVICE_SECRET: `notifications-${id}`,
        EXPLORE_SERVICE_SECRET: `explore-${id}`,
        ENABLE_EMAIL_PASSWORD: 'true',
        ENABLE_GOOGLE: 'false',
        ENABLE_GITHUB: 'false',
        ENABLE_ANONYMOUS: 'false',
        REPLY_NOTIFICATION_WORKER_ENABLED: 'false',
        MENTION_NOTIFICATION_WORKER_ENABLED: 'false',
        FAVORITE_UPDATE_WORKER_ENABLED: 'false',
        EDITORIAL_URL: 'http://127.0.0.1:1',
        DISCUSSION_URL: 'http://127.0.0.1:1',
        OPA_URL: `http://127.0.0.1:${policyPort}`,
        AUTHENTICATION_URL: `http://127.0.0.1:${authPort}`,
        ACCOUNT_MANAGEMENT_URL: `http://127.0.0.1:${accountPort}`,
      };
      const credentialEnv = {
        ...env,
        MYSQL_USERNAME: 'authentication',
        MYSQL_DATABASE: 'authentication',
      };
      const authBundle = 'sdk/features/identity/applications/authenticator';
      const accountBundle = 'sdk/features/identity/applications/management';
      const migrate = () =>
        execute(
          process.execPath,
          [path.join(root, 'dist', accountBundle, 'main.js'), '--migrate'],
          { cwd: root, env, timeout: 30000 }
        );
      await migrate();
      await migrate();
      await assert.rejects(
        () =>
          execute(
            process.execPath,
            [path.join(root, 'dist', authBundle, 'main.js'), '--migrate'],
            { cwd: root, env, timeout: 30000 }
          ),
        (error) => {
          assert.equal(error.code, 1);
          return true;
        }
      );
      await execute(
        process.execPath,
        [path.join(root, 'dist', authBundle, 'main.js'), '--migrate'],
        { cwd: root, env: credentialEnv, timeout: 30000 }
      );
      source = identityDataSource(env);
      credentialSource = credentialDataSource(credentialEnv);
      await credentialSource.initialize();
      await assert.rejects(
        () => credentialSource.query('SELECT id FROM identity.identities'),
        /denied/
      );

      await source.initialize();
      assert.equal(await source.showMigrations(), false);
      await assert.rejects(
        () => assertCredentialDatabase(source),
        /Authentication requires its own credential database/
      );
      assert.deepEqual(
        await source.query("SHOW TABLES LIKE 'local_credential_%'"),
        []
      );
      await assert.rejects(
        () =>
          source.query('SELECT uid FROM authentication.local_credential_users'),
        /denied/
      );
      assert.equal(await credentialSource.showMigrations(), false);
      await qualifyLegacyIdentityImport(source);

      let auth = await start(
        authBundle,
        { ...credentialEnv, PORT: String(authPort) },
        authPort,
        '/health'
      );
      let account = await start(
        accountBundle,
        { ...env, ACCOUNT_MANAGEMENT_PORT: String(accountPort) },
        accountPort,
        '/api/health'
      );
      let bff = await start(
        'apps/services/catalog-bff',
        { ...env, PORT: String(bffPort) },
        bffPort,
        '/api/health'
      );
      let origin = bff.origin;
      async function call(
        route,
        { body, token, headers = {}, status = 200, at = origin, method } = {}
      ) {
        const response = await fetch(at + route, {
          method: method ?? (body === undefined ? 'GET' : 'POST'),
          headers: {
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(20000),
        }).catch(async (error) => {
          if (nativeIngress) console.error(nativeIngress.diagnostics());
          const gateway = names.find((name) => name.includes('-ingress-'));
          if (gateway) {
            const logs = await docker(['logs', '--tail', '12', gateway]);
            console.error(
              (logs.stdout + logs.stderr).replaceAll(password, '[redacted]')
            );
            const sockets = await docker(['exec', gateway, 'netstat', '-ant']);
            console.error(
              sockets.stdout
                .split('\n')
                .filter((line) => /SYN_SENT|ESTABLISHED|CLOSE_WAIT/.test(line))
                .join('\n')
            );
            for (const [name, port, health] of [
              ['authentication', authPort, '/health'],
              ['account', accountPort, '/api/health'],
              ['bff', bffPort, '/api/health'],
            ]) {
              try {
                const result = await fetch(
                  `http://127.0.0.1:${port}${health}`,
                  { signal: AbortSignal.timeout(2000) }
                );
                await result.arrayBuffer();
                console.error(
                  `${name} direct health after transport failure: ${result.status}`
                );
              } catch {
                console.error(
                  `${name} direct health after transport failure: unavailable`
                );
              }
            }
          }
          throw new Error(
            `HTTP transport failed: ${
              method ?? (body === undefined ? 'GET' : 'POST')
            } ${route}`,
            { cause: error }
          );
        });
        const content = await response.text();
        if (response.status !== status) {
          if (nativeIngress) console.error(nativeIngress.diagnostics());
          const gateway = names.find((name) => name.includes('-ingress-'));
          if (gateway) {
            const logs = await docker(['logs', '--tail', '12', gateway]);
            console.error(
              (logs.stdout + logs.stderr).replaceAll(password, '[redacted]')
            );
          }
        }
        assert.equal(
          response.status,
          status,
          `${route}: HTTP ${
            response.status
          }, expected ${status}: ${content.slice(0, 160)}`
        );
        if (route.startsWith('/auth/') || route.startsWith('/api/auth/'))
          assert.equal(response.headers.get('cache-control'), 'no-store');
        return content.startsWith('{') || content === 'null'
          ? JSON.parse(content)
          : content;
      }
      const email = 'member@example.test',
        input = {
          email,
          password: 'local-password',
          passwordConfirmation: 'local-password',
          nickname: 'Local Member',
        };
      const enrolled = await call('/api/auth/register', {
        body: input,
        headers: { 'Idempotency-Key': 'initial' },
      });
      const login = await call('/api/auth/signin', {
        body: { email, password: input.password },
      });
      assert.equal(login.uid, enrolled.uid);
      await call('/api/auth/signin', {
        body: { email, password: 'wrong-password' },
        status: 401,
      });
      await call('/api/auth/register', {
        body: { ...input, roles: ['admin'] },
        headers: { 'Idempotency-Key': 'forged' },
        status: 400,
      });
      assert.deepEqual(
        (await call('/api/auth/methods')).methods.map(
          (method) => method.provider
        ),
        ['EMAIL_PASSWORD']
      );
      await call('/api/auth/signin/anonymous', { body: {}, status: 403 });
      await call('/api/auth/signin/oauth', {
        body: {
          provider: 'google',
          code: 'fake',
          redirectUri: 'http://localhost/auth/callback',
        },
        status: 403,
      });
      await call('/api/auth/email-verification/request', {
        body: {},
        token: login.token,
        status: 503,
      });
      await call('/api/password-recovery', { body: { email }, status: 503 });
      console.log(
        'PASS production BFF -> Identity -> Authentication registration/sign-in; explicit local methods, denial and unavailable email actions'
      );

      // Qualify the checked-in local gateway route include, substituting only dependency addresses.
      const config = readFileSync(
        path.join(root, 'deploy/local/nginx/api.conf'),
        'utf8'
      )
        .replaceAll('/etc/nginx/local/', '/etc/nginx/qualification/')
        .replace(/http:\/\/([a-z_-]+)(?::\d+)?/g, (_all, service) =>
          service === 'local_auth'
            ? 'http://local_auth'
            : `http://host.docker.internal:${
                service === 'catalog-bff'
                  ? bffPort
                  : service === 'account-management'
                  ? accountPort
                  : service === 'authenticator'
                  ? authPort
                  : 1
              }`
        );
      writeFileSync(path.join(directory, 'api.conf'), config);
      writeFileSync(
        path.join(directory, 'alpha-api.conf'),
        readFileSync(path.join(root, 'deploy/alpha/nginx/api.conf'), 'utf8')
          .replaceAll('/etc/nginx/wapps/', '/etc/nginx/qualification/')
          .replaceAll('/auth.conf', '/alpha-auth.conf')
          .replace(/http:\/\/([a-z_-]+)(?::\d+)?/g, (_all, service) =>
            service === 'local_auth'
              ? 'http://local_auth'
              : `http://host.docker.internal:${
                  service === 'catalog-bff'
                    ? bffPort
                    : service === 'account-management'
                    ? accountPort
                    : service === 'firebase-auth-validator'
                    ? authPort
                    : 1
                }`
          )
      );
      writeFileSync(
        path.join(directory, 'alpha-auth.conf'),
        readFileSync(path.join(root, 'deploy/alpha/nginx/auth.conf'))
      );
      writeFileSync(
        path.join(directory, 'auth.conf'),
        readFileSync(path.join(root, 'deploy/local/nginx/auth.conf'))
      );
      writeFileSync(
        path.join(directory, 'application-media.conf'),
        '# Media is outside this authentication qualification.\n'
      );
      writeFileSync(
        path.join(directory, 'nginx.conf'),
        `events {}\nhttp {
      log_format qualification '$request $status $request_time $upstream_addr $upstream_status $upstream_response_time';
      access_log /dev/stdout qualification;
      log_subrequest on;
      limit_req_zone $binary_remote_addr zone=identity_recovery:1m rate=100r/s;
      limit_req_zone $binary_remote_addr zone=identity_enrollment:1m rate=100r/s;
      map $http_authorization $validation_path { "" /api/internal/authentication/validate-optional; default /api/internal/authentication/validate; }
      upstream local_auth { server host.docker.internal:${accountPort}; }
      server { listen 8080; include /etc/nginx/qualification/api.conf; }
      server { listen 8081; include /etc/nginx/qualification/alpha-api.conf; }
    }\n`
      );
      let alphaOrigin;
      if (process.env.WAPPS_NGINX_BINARY) {
        const {
          nativeQualificationGateway,
        } = require('./native-qualification-gateway.cjs');
        nativeIngress = await nativeQualificationGateway({
          binary: process.env.WAPPS_NGINX_BINARY,
          directory,
          freePort,
          execute,
        });
        processes.push(nativeIngress);
        origin = nativeIngress.origin;
        alphaOrigin = `http://127.0.0.1:${nativeIngress.ports.alpha}`;
      } else {
        const ingress = `wapps-auth-qualification-ingress-${id}`;
        await docker([
          'run',
          '--detach',
          '--pull=never',
          '--name',
          ingress,
          ...(process.platform === 'linux'
            ? ['--add-host', 'host.docker.internal:host-gateway']
            : []),
          '--publish',
          `127.0.0.1:${await freePort()}:8080`,
          '--publish',
          `127.0.0.1:${await freePort()}:8081`,
          '--mount',
          `type=bind,source=${directory},target=/etc/nginx/qualification,readonly`,
          'nginx:1.28-alpine',
          'nginx',
          '-c',
          '/etc/nginx/qualification/nginx.conf',
          '-g',
          'daemon off;',
        ]);
        names.push(ingress);
        const { stdout } = await docker([
          'inspect',
          '--format',
          '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}',
          ingress,
        ]);
        origin = `http://127.0.0.1:${Number(stdout.trim())}`;
        const alphaPort = await docker([
          'inspect',
          '--format',
          '{{(index (index .NetworkSettings.Ports "8081/tcp") 0).HostPort}}',
          ingress,
        ]);
        alphaOrigin = `http://127.0.0.1:${Number(alphaPort.stdout.trim())}`;
        await docker([
          'exec',
          ingress,
          'nginx',
          '-c',
          '/etc/nginx/qualification/nginx.conf',
          '-t',
        ]);
      }
      // Exercise the complete local gateway with domain services absent from DNS.
      const gatewayDirectory = path.join(directory, 'full-gateway');
      mkdirSync(gatewayDirectory);
      for (const file of [
        'gateway.conf',
        'api.conf',
        'auth.conf',
        'application-media.conf',
      ]) {
        const contents = readFileSync(
          path.join(root, 'deploy/local/nginx', file),
          'utf8'
        )
          .replaceAll('/etc/nginx/local/', '/etc/nginx/qualification/')
          .replaceAll(
            'server account-management:1340;',
            `server host.docker.internal:${accountPort};`
          )
          .replaceAll(
            'http://account-management:1340',
            `http://host.docker.internal:${accountPort}`
          )
          .replaceAll(
            'http://catalog-bff:3000',
            `http://host.docker.internal:${bffPort}`
          )
          .replace(
            /http:\/\/(aggregator-csr|discussion-csr|catalog-csr):80/g,
            `http://host.docker.internal:${bffPort}`
          );
        writeFileSync(path.join(gatewayDirectory, file), contents);
      }
      writeFileSync(
        path.join(gatewayDirectory, 'nginx.conf'),
        'events {}\nhttp { access_log off; include /etc/nginx/qualification/gateway.conf; }\n'
      );
      const fullGatewayPort = await container(
        'full-gateway',
        'nginx:1.28-alpine',
        4200,
        [
          ...(process.platform === 'linux'
            ? ['--add-host', 'host.docker.internal:host-gateway']
            : []),
          '--mount',
          `type=bind,source=${gatewayDirectory},target=/etc/nginx/qualification,readonly`,
        ],
        [
          'nginx',
          '-c',
          '/etc/nginx/qualification/nginx.conf',
          '-g',
          'daemon off;',
        ]
      );
      await docker([
        'exec',
        names.at(-1),
        'nginx',
        '-c',
        '/etc/nginx/qualification/nginx.conf',
        '-t',
      ]);
      const fullGatewayOrigin = `http://127.0.0.1:${fullGatewayPort}`;
      assert.deepEqual(
        (await call('/auth/methods', { at: fullGatewayOrigin })).methods.map(
          (method) => method.provider
        ),
        ['EMAIL_PASSWORD']
      );
      assert.equal(
        (await call('/api/me', { at: fullGatewayOrigin, token: login.token }))
          .uid,
        login.uid
      );
      await call(
        '/api/editorial/health-monitors/11111111-1111-4111-8111-111111111111',
        {
          at: fullGatewayOrigin,
          token: login.token,
          status: 503,
        }
      );
      await call('/api/me', { at: fullGatewayOrigin, status: 401 });
      console.log(
        'PASS complete local gateway starts without domain services; BFF authentication remains available and absent domain routes fail'
      );
      const me = await call('/api/me', {
        token: login.token,
        headers: {
          'X-User-Id': 'forged',
          'X-User-Claims': '{"roles":["admin"]}',
        },
      });
      assert.equal(me.uid, login.uid);
      await call('/api/me', {
        headers: {
          'X-User-Id': login.uid,
          'X-Ingress-Auth': env.INGRESS_AUTH_SECRET,
        },
        status: 401,
      });
      const fresh = await call('/auth/refresh', {
        body: { refreshToken: login.refreshToken },
        token: 'expired',
      });
      await call('/auth/refresh', {
        body: { refreshToken: login.refreshToken },
        status: 401,
      });
      const concurrent = await Promise.all(
        [0, 1].map(() =>
          fetch(origin + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: fresh.refreshToken }),
          })
        )
      );
      assert.deepEqual(
        concurrent.map((result) => result.status).sort(),
        [200, 401]
      );
      const rotated = await concurrent
        .find((result) => result.status === 200)
        .json();
      await call('/auth/signout', { body: {}, token: rotated.token });
      await call('/auth/refresh', {
        body: { refreshToken: enrolled.refreshToken },
        status: 401,
      });
      await call('/api/me', { token: enrolled.token, status: 401 });
      console.log(
        'PASS checked-in ingress -> BFF routes; trusted identity stripping, stale bearer refresh, single-use rotation and all-session sign-out'
      );

      const identities = new MysqlCanonicalIdentities(source),
        credentials = new MysqlLocalCredentials(credentialSource);
      const remoteCredentials = new RemoteCredentials(
        env.AUTHENTICATION_URL,
        env.AUTH_ISSUER,
        env.AUTH_SERVICE_SECRET,
        identities
      );
      const subjectFor = async (identityId) =>
        (await identities.credentialSubjects(identityId))[0].subject;
      assert.notEqual(enrolled.uid, await subjectFor(enrolled.uid));
      assert.match(enrolled.uid, /^[0-9a-f-]{36}$/);
      assert.equal(
        await identities.findCredential({
          issuer: env.AUTH_ISSUER.toUpperCase(),
          subject: await subjectFor(enrolled.uid),
        }),
        null
      );
      assert.equal(
        await identities.findCredential({
          issuer: env.AUTH_ISSUER,
          subject: (await subjectFor(enrolled.uid)).toUpperCase(),
        }),
        null
      );
      await assert.rejects(() =>
        identities.enrollCredential(
          { issuer: 'unconfigured', subject: 'unbound-subject' },
          false
        )
      );

      const second = await call('/auth/signin', {
        body: { email, password: input.password },
      });
      await auth.stop();
      await bff.stop();
      auth = await start(
        authBundle,
        { ...credentialEnv, PORT: String(authPort) },
        authPort,
        '/health'
      );
      bff = await start(
        'apps/services/catalog-bff',
        { ...env, PORT: String(bffPort) },
        bffPort,
        '/api/health'
      );
      assert.equal(
        (await call('/api/me', { token: second.token })).uid,
        second.uid
      );
      await identities.setSuspended(second.uid, true);
      await call('/api/me', { token: second.token, status: 401 });
      await call('/auth/signin', {
        body: { email, password: input.password },
        status: 401,
      });
      await call('/auth/refresh', {
        body: { refreshToken: second.refreshToken },
        status: 401,
      });
      await identities.setSuspended(second.uid, false);
      const restored = await call('/auth/signin', {
        body: { email, password: input.password },
      });
      const tokenHash = createHash('sha256')
        .update(restored.token)
        .digest('hex');
      await credentialSource.query(
        'UPDATE local_credential_sessions SET access_expires_at = 0 WHERE access_hash = ?',
        [tokenHash]
      );
      await call('/api/me', { token: restored.token, status: 401 });
      await credentialSource.query(
        'UPDATE local_credential_sessions SET refresh_expires_at = 0 WHERE access_hash = ?',
        [tokenHash]
      );
      await call('/auth/refresh', {
        body: { refreshToken: restored.refreshToken },
        status: 401,
      });
      console.log(
        'PASS independent service restarts preserve credentials/sessions; canonical suspension, access expiry and refresh expiry deny access'
      );

      const replay = await call('/auth/register', {
        body: input,
        headers: { 'Idempotency-Key': 'initial' },
      });
      assert.equal(replay.uid, enrolled.uid);
      const interrupted = { ...input, email: 'identity-rollback@example.test' };
      const beforeCreation = await source.query(
        'SELECT COUNT(*) AS count FROM identities'
      );
      await source.query(
        "CREATE TRIGGER fail_binding_event BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification identity rollback'"
      );
      try {
        await call('/auth/register', {
          body: interrupted,
          headers: { 'Idempotency-Key': 'identity-rollback' },
          status: 503,
        });
        assert.equal(
          Number(
            (await source.query('SELECT COUNT(*) AS count FROM identities'))[0]
              .count
          ),
          Number(beforeCreation[0].count)
        );
      } finally {
        await source.query('DROP TRIGGER fail_binding_event');
      }
      await call('/auth/signin', {
        body: { email: interrupted.email, password: interrupted.password },
        status: 401,
      });
      await call('/auth/register', {
        body: interrupted,
        headers: { 'Idempotency-Key': 'different-key' },
        status: 403,
      });
      const recoveredIdentity = await call('/auth/register', {
        body: interrupted,
        headers: { 'Idempotency-Key': 'identity-rollback' },
      });
      assert.notEqual(
        recoveredIdentity.uid,
        await subjectFor(recoveredIdentity.uid)
      );
      const creationEvents = await source.query(
        "SELECT COUNT(*) AS count FROM identity_events_outbox WHERE identityId = ? AND eventType = 'identity.created'",
        [recoveredIdentity.uid]
      );
      assert.equal(Number(creationEvents[0].count), 1);
      await call('/api/internal/authentication/validate', {
        token: replay.token,
        status: 404,
      });
      const racingInput = { ...input, email: 'concurrent@example.test' };
      const racing = await Promise.all(
        [0, 1].map(() =>
          call('/auth/register', {
            body: racingInput,
            headers: { 'Idempotency-Key': 'concurrent-registration' },
          })
        )
      );
      assert.equal(racing[0].uid, racing[1].uid);
      assert.equal(
        (
          await credentialSource.query(
            'SELECT uid FROM local_credential_users WHERE email = ?',
            [racingInput.email]
          )
        ).length,
        1
      );
      await credentialSource.query(
        "CREATE TRIGGER fail_local_session BEFORE INSERT ON local_credential_sessions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'qualification rollback'"
      );
      try {
        await call('/auth/register', {
          body: { ...input, email: 'rollback@example.test' },
          headers: { 'Idempotency-Key': 'rollback' },
          status: 503,
        });
        assert.equal(
          (
            await credentialSource.query(
              'SELECT uid FROM local_credential_users WHERE email = ?',
              ['rollback@example.test']
            )
          ).length,
          0
        );
      } finally {
        await credentialSource.query('DROP TRIGGER fail_local_session');
      }
      await call('/auth/register', {
        body: { ...input, email: 'rollback@example.test' },
        headers: { 'Idempotency-Key': 'rollback' },
      });
      const provisioned = await execute(
        process.execPath,
        [path.join(root, 'dist', authBundle, 'main.js'), '--local-user'],
        {
          cwd: root,
          env: {
            ...credentialEnv,
            LOCAL_AUTH_USER_EMAIL: 'operator@example.test',
            LOCAL_AUTH_USER_PASSWORD: 'operator-password',
            LOCAL_AUTH_USER_ROLES: 'admin',
          },
          timeout: 30000,
        }
      );
      const operatorSubject = JSON.parse(provisioned.stdout.trim()).subject;
      await call('/auth/signin', {
        body: { email: 'operator@example.test', password: 'operator-password' },
        status: 401,
      });
      const operator = await call('/auth/register', {
        body: {
          email: 'operator@example.test',
          password: 'operator-password',
          passwordConfirmation: 'operator-password',
          nickname: 'Local Developer',
        },
        headers: {
          'Idempotency-Key': `local-user:${createHash('sha256')
            .update('operator@example.test')
            .digest('hex')}`,
        },
      });
      assert.equal(await subjectFor(operator.uid), operatorSubject);
      assert.notEqual(operator.uid, operatorSubject);
      assert.deepEqual(
        (await credentials.verifyIdToken(operator.token)).value.claims,
        { roles: ['admin'] }
      );

      const targetInput = { ...input, email: 'admin-target@example.test' };
      const target = await call('/auth/register', {
        body: targetInput,
        headers: { 'Idempotency-Key': 'admin-target' },
      });
      const targetLogin = () =>
        call('/auth/signin', {
          body: { email: targetInput.email, password: targetInput.password },
        });
      const adminPath = (action, uid = target.uid) =>
        `/api/admin/users/${encodeURIComponent(uid)}/${action}`;
      const admin = (action, options = {}) =>
        call(adminPath(action), {
          method: 'POST',
          token: operator.token,
          status: 201,
          ...options,
        });
      const initial = await identities.find(target.uid);
      for (const at of [origin, alphaOrigin]) {
        await call(adminPath('disable', 'invalid/subject'), {
          at,
          method: 'POST',
          token: operator.token,
          status: 400,
        });
      }
      for (const action of ['disable', 'enable', 'revoke-tokens']) {
        await admin(action, { token: target.token, status: 403 });
        await admin(action, { token: undefined, status: 401 });
        await admin(action, {
          token: target.token,
          status: 403,
          headers: {
            'X-User-Id': operator.uid,
            'X-User-Claims': JSON.stringify({ roles: ['admin'] }),
            'X-Ingress-Auth': env.INGRESS_AUTH_SECRET,
          },
        });
      }
      assert.equal(
        (await identities.find(target.uid)).revision,
        initial.revision
      );
      await call(adminPath('disable') + '?tenantId=other', {
        method: 'POST',
        token: operator.token,
        status: 400,
      });
      await call(adminPath('disable', target.uid.toUpperCase()), {
        method: 'POST',
        token: operator.token,
        status: 409,
      });
      const scoped = await call('/auth/register', {
        body: {
          ...input,
          email: 'scoped-admin@example.test',
          password: 'scoped-password',
          passwordConfirmation: 'scoped-password',
        },
        headers: { 'Idempotency-Key': 'scoped-admin' },
      });
      await credentials.setOperatorClaims(await subjectFor(scoped.uid), {
        roles: ['admin'],
        tenantId: 'Tenant-A',
      });
      const scopedLogin = await call('/auth/signin', {
        body: {
          email: 'scoped-admin@example.test',
          password: 'scoped-password',
        },
      });
      for (const action of ['disable', 'enable', 'revoke-tokens'])
        await admin(action, { token: scopedLogin.token, status: 403 });

      await docker(['pause', policyContainer]);
      try {
        for (const action of ['disable', 'enable', 'revoke-tokens'])
          await admin(action, { status: 503 });
        assert.equal(
          (await identities.find(target.uid)).revision,
          initial.revision
        );
        assert.equal((await credentials.verifyIdToken(target.token)).ok, true);
      } finally {
        await docker(['unpause', policyContainer]);
      }
      for (let attempt = 0; ; attempt++) {
        try {
          if ((await fetch(`http://127.0.0.1:${policyPort}/health`)).ok) break;
        } catch {
          /* readiness */
        }
        assert(attempt < 50, 'Policy did not restart');
        await delay(100);
      }
      await source.query(
        `CREATE TRIGGER fail_admin_suspend BEFORE UPDATE ON identities FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected admin rollback'`
      );
      try {
        await admin('disable', { status: 503 });
        assert.equal(
          (await identities.find(target.uid)).revision,
          initial.revision
        );
      } finally {
        await source.query('DROP TRIGGER fail_admin_suspend');
      }
      assert.deepEqual(await admin('disable'), { disabled: true });
      assert.equal(
        (await identities.find(target.uid)).revision,
        initial.revision + 1
      );
      await admin('disable');
      assert.equal(
        (await identities.find(target.uid)).revision,
        initial.revision + 1
      );
      await call('/api/me', { token: target.token, status: 401 });
      await call('/auth/refresh', {
        body: { refreshToken: target.refreshToken },
        status: 401,
      });
      await call('/auth/signin', {
        body: { email: targetInput.email, password: targetInput.password },
        status: 401,
      });
      assert.deepEqual(await admin('revoke-tokens'), { revoked: true });
      assert.deepEqual(await admin('enable'), { enabled: true });
      await admin('enable');
      assert.equal(
        (await identities.find(target.uid)).revision,
        initial.revision + 2
      );
      await call('/api/me', { token: target.token, status: 401 });
      await call('/auth/refresh', {
        body: { refreshToken: target.refreshToken },
        status: 401,
      });
      const sessions = [await targetLogin(), await targetLogin()];
      await admin('revoke-tokens');
      for (const session of sessions) {
        await call('/api/me', { token: session.token, status: 401 });
        await call('/auth/refresh', {
          body: { refreshToken: session.refreshToken },
          status: 401,
        });
      }
      await targetLogin();
      assert.equal((await credentials.verifyIdToken(operator.token)).ok, true);
      const lifecycle = await source.query(
        `SELECT COUNT(*) AS count FROM identity_events_outbox WHERE identityId = ? AND eventType = 'identity.updated' AND revision > ?`,
        [target.uid, initial.revision]
      );
      assert.equal(Number(lifecycle[0].count), 2);
      for (const action of ['disable', 'revoke-tokens', 'enable']) {
        await admin(action, {
          at: alphaOrigin,
          token: scopedLogin.token,
          status: 403,
        });
        await call(adminPath(action) + '?unexpected=scope', {
          method: 'POST',
          at: alphaOrigin,
          token: operator.token,
          status: 400,
        });
        await admin(action, { at: alphaOrigin });
      }
      await targetLogin();
      console.log(
        'PASS staff account administration through BFF/ingress with real OPA: exact scope, forged headers, policy/SQL failures, suspension, re-enablement, revocation, canonical revisions and durable lifecycle events'
      );
      await qualifyAccountAdmin({
        call,
        origins: [origin, alphaOrigin],
        operator,
        scoped: scopedLogin,
        input,
        source,
        credentialSource,
        identities,
        subjectFor,
        ingressSecret: env.INGRESS_AUTH_SECRET,
      });
      await bff.stop();
      try {
        for (const at of [origin, alphaOrigin]) {
          for (const [action, method, body] of [
            ['email', 'PATCH', { email: targetInput.email }],
            ['password', 'PATCH', { password: 'replacement-password' }],
            ['unlink-providers', 'POST', { providersToUnlink: ['google.com'] }],
            [
              'generate-password-reset-link',
              'POST',
              { email: targetInput.email },
            ],
            [
              'generate-email-verification-link',
              'POST',
              { email: targetInput.email },
            ],
            ['', 'DELETE', undefined],
            ['identity', 'GET', undefined],
            ['deletion-status', 'GET', undefined],
          ])
            await call(adminPath(action), {
              at,
              method,
              body,
              token: operator.token,
              status: 502,
            });
        }
      } finally {
        bff = await start(
          'apps/services/catalog-bff',
          { ...env, PORT: String(bffPort) },
          bffPort,
          '/api/health'
        );
      }
      assert.equal(
        (await call(adminPath('identity'), { token: operator.token }))
          .identityId,
        target.uid
      );
      console.log(
        'PASS both gateway administration route sets fail when BFF is stopped and recover without direct-owner fallback'
      );
      const restartAccount = async (overrides = {}) => {
        await account.stop();
        account = await start(
          accountBundle,
          {
            ...env,
            ...overrides,
            ACCOUNT_MANAGEMENT_PORT: String(accountPort),
          },
          accountPort,
          '/api/health'
        );
      };
      const restartBff = async (overrides = {}) => {
        await bff.stop();
        bff = await start(
          'apps/services/catalog-bff',
          {
            ...env,
            ...overrides,
            PORT: String(bffPort),
          },
          bffPort,
          '/api/health'
        );
      };
      const serviceLifecycle = {
        restartAccount,
        restartBff,
        stopBff: () => bff.stop(),
        pausePolicy: () => docker(['pause', policyContainer]),
        resumePolicy: () => docker(['unpause', policyContainer]),
      };
      await qualifyAccountSettings({
        call,
        origins: [origin, alphaOrigin],
        input,
        source,
        identities,
        ingressSecret: env.INGRESS_AUTH_SECRET,
        ...serviceLifecycle,
      });
      if (process.env.WAPPS_SUITE_PARITY_INTEGRATION === '1') {
        const { suiteParityServices } = require('./suite-parity-services.cjs');
        const { qualifySuiteParity } = require('./bff-suite-parity-checks.cjs');
        const services = await suiteParityServices({
          root,
          env,
          password,
          container,
          names,
          start,
          freePort,
          execute,
          processes,
        });
        console.log(
          'SUITE qualification resources ' +
            JSON.stringify({
              root,
              node: process.version,
              containers: [...names],
              endpoints: services.endpoints,
              gateway: process.env.WAPPS_NGINX_BINARY ?? 'docker',
            })
        );
        try {
          await restartAccount(services.endpoints);
          await restartBff(services.endpoints);
          await qualifySuiteParity({
            call,
            origins: [origin, alphaOrigin],
            input,
            source,
            identities,
            credentials,
            subjectFor,
            services,
            ...serviceLifecycle,
            restartAccount: () => restartAccount(services.endpoints),
            restartBff: () => restartBff(services.endpoints),
          });
        } finally {
          await services.close();
          await restartAccount();
          await restartBff();
        }
      }
      if (
        process.env.WAPPS_PUBLIC_PROFILES_INTEGRATION === '1' ||
        process.env.WAPPS_MEMBER_PARITY_INTEGRATION === '1' ||
        process.env.WAPPS_EXPORT_PARITY_INTEGRATION === '1'
      ) {
        const {
          profileParityServices,
        } = require('./profile-parity-services.cjs');
        const {
          qualifyPublicProfiles,
        } = require('./bff-profile-parity-runtime-checks.cjs');
        const services = await profileParityServices({
          root,
          env,
          password,
          container,
          start,
          freePort,
          execute,
          processes,
        });
        try {
          const memberParity =
            process.env.WAPPS_MEMBER_PARITY_INTEGRATION === '1';
          const accountEndpoints = {
            ...services.endpoints,
            ...(memberParity
              ? {
                  REPLY_NOTIFICATION_WORKER_ENABLED: 'true',
                  MENTION_NOTIFICATION_WORKER_ENABLED: 'true',
                  FAVORITE_UPDATE_WORKER_ENABLED: 'true',
                }
              : {}),
          };
          const qualify = memberParity
            ? require('./bff-favorites-inbox-parity-checks.cjs')
                .qualifyFavoritesInboxes
            : process.env.WAPPS_EXPORT_PARITY_INTEGRATION === '1'
            ? require('./bff-export-parity-runtime-checks.cjs')
                .qualifyExportParity
            : qualifyPublicProfiles;
          await restartAccount(accountEndpoints);
          await restartBff(services.endpoints);
          await qualify({
            call,
            origins: [origin, alphaOrigin],
            input,
            source,
            identities,
            operator,
            scoped: scopedLogin,
            services,
            credentials,
            subjectFor,
            ingressSecret: env.INGRESS_AUTH_SECRET,
            ...serviceLifecycle,
            restartAccount: (overrides = {}) =>
              restartAccount({ ...accountEndpoints, ...overrides }),
            restartBff: (overrides = {}) =>
              restartBff({ ...services.endpoints, ...overrides }),
            crashAccount: () => account.crash(),
            stopAccount: () => account.stop(),
            stopAuth: () => auth.stop(),
            restartAuth: async () => {
              await auth.stop();
              auth = await start(
                authBundle,
                { ...credentialEnv, PORT: String(authPort) },
                authPort,
                '/health'
              );
            },
          });
        } finally {
          await services.close();
          await restartAccount();
          await restartBff();
        }
      }
      const duplicateEmail = await remoteCredentials.updateUser(operator.uid, {
        email: racingInput.email,
      });
      assert.equal(duplicateEmail.ok, false);
      assert.equal(duplicateEmail.error.message, 'Credential update rejected');
      assert.equal(
        (
          await remoteCredentials.updateUser(operator.uid, {
            password: 'changed-password',
          })
        ).ok,
        true
      );
      await call('/auth/refresh', {
        body: { refreshToken: operator.refreshToken },
        status: 401,
      });
      await call('/auth/signin', {
        body: { email: 'operator@example.test', password: 'operator-password' },
        status: 401,
      });
      await call('/auth/signin', {
        body: { email: 'operator@example.test', password: 'changed-password' },
      });
      console.log(
        'PASS concurrent enrollment, credential transaction rollback/retry, explicit local operator provisioning and password-change revocation'
      );
      const capture = [];
      for await (const entry of remoteCredentials.capture(
        replay.uid,
        new AbortController().signal
      ))
        capture.push(entry);
      assert.equal(capture.at(-1).type, 'end');
      assert(!JSON.stringify(capture).includes('password'));
      assert.equal(
        (await remoteCredentials.deleteUser('foreign-provider-subject')).ok,
        false
      );
      const [stored] = await credentialSource.query(
        'SELECT * FROM local_credential_users WHERE uid = ?',
        [await subjectFor(replay.uid)]
      );
      assert.notEqual(stored.password_hash, input.password);
      assert(
        !JSON.stringify(
          await credentialSource.query(
            'SELECT * FROM local_credential_sessions'
          )
        ).includes(replay.token)
      );
      const accountCapture = [];
      for await (const entry of new MysqlAccountExportSource(source).capture(
        replay.uid,
        new AbortController().signal
      ))
        accountCapture.push(entry);
      const exportedBinding = accountCapture.find(
        (entry) =>
          entry.type === 'record' && entry.collection === 'credential-binding'
      );
      assert.equal(exportedBinding.data.subject, await subjectFor(replay.uid));
      assert.equal(exportedBinding.data.issuer, env.AUTH_ISSUER);
      const boundSubject = await subjectFor(replay.uid);
      const beforeSwap = await identities.account(replay.uid);
      await account.stop();
      const directProof = await fetch(
        auth.origin + '/credentials/verify-token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-credential-service': env.AUTH_SERVICE_SECRET,
          },
          body: JSON.stringify({ token: replay.token }),
        }
      );
      assert.equal(
        directProof.status,
        200,
        'Authentication operates while Identity is stopped'
      );
      account = await start(
        accountBundle,
        { ...env, ACCOUNT_MANAGEMENT_PORT: String(accountPort) },
        accountPort,
        '/api/health'
      );
      await auth.stop();
      const alternatePath = path.join(
        directory,
        'alternate-authentication.cjs'
      );
      writeFileSync(
        alternatePath,
        `const http = require('node:http');
        http.createServer(async (req, res) => {
          if (req.url === '/health') { res.end('healthy'); return; }
          if (req.headers['x-credential-service'] !== process.env.AUTH_SERVICE_SECRET) { res.writeHead(401); res.end(); return; }
          let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 32768) { res.writeHead(413); res.end(); return; } }
          const body = JSON.parse(raw);
          if (req.url !== '/credentials/verify-token' || body.token !== 'alternate-proof') { res.writeHead(401); res.end(); return; }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ issuer: process.env.AUTH_ISSUER, value: { subject: process.env.QUALIFICATION_SUBJECT, claims: {} } }));
        }).listen(Number(process.env.PORT), '0.0.0.0');`
      );
      const alternate = await processService(
        process.execPath,
        [alternatePath],
        {
          cwd: directory,
          env: {
            PATH: process.env.PATH,
            PORT: String(authPort),
            AUTH_ISSUER: env.AUTH_ISSUER,
            AUTH_SERVICE_SECRET: env.AUTH_SERVICE_SECRET,
            QUALIFICATION_SUBJECT: boundSubject,
          },
        },
        () => `http://127.0.0.1:${authPort}`,
        '/health'
      );
      processes.push(alternate);
      assert.equal(
        (await call('/api/me', { token: 'alternate-proof' })).uid,
        replay.uid
      );
      assert.deepEqual(await identities.account(replay.uid), beforeSwap);
      await identities.setSuspended(replay.uid, true);
      await call('/api/me', { token: 'alternate-proof', status: 401 });
      await identities.setSuspended(replay.uid, false);
      await alternate.stop();
      auth = await start(
        authBundle,
        { ...credentialEnv, PORT: String(authPort) },
        authPort,
        '/health'
      );
      assert.equal(
        (await call('/api/me', { token: replay.token })).uid,
        replay.uid
      );
      console.log(
        'PASS independent authentication and Identity database grants; alternate standalone authentication process retains stable identity/profile and respects canonical suspension'
      );

      const deleted = await identities.requestDeletion(replay.uid);
      assert.equal(deleted.isDeleted, true);
      await call('/api/me', { token: replay.token, status: 401 });
      for (let attempt = 0; ; attempt++) {
        const [record] = await credentialSource.query(
          'SELECT deleted, email, password_hash FROM local_credential_users WHERE uid = ?',
          [await subjectFor(replay.uid)]
        );
        if (record.deleted) {
          assert.equal(record.email, null);
          assert.equal(record.password_hash, null);
          break;
        }
        if (attempt >= 100)
          throw new Error('Credential cleanup worker did not complete');
        await delay(100);
      }
      assert.equal((await remoteCredentials.deleteUser(replay.uid)).ok, true);
      await docker(['stop', '--time', '3', names[0]]);
      await call('/auth/signout', {
        body: {},
        token: racing[0].token,
        status: 503,
      });
      await call('/auth/signin', {
        body: { email: racingInput.email, password: input.password },
        status: 503,
      });
      await auth.stop();
      await call('/auth/signin', {
        body: { email, password: input.password },
        status: 503,
      });
      console.log(
        'PASS registration replay, secret-free credentials export, foreign-subject refusal, canonical deletion, durable worker cleanup and provider outage'
      );
    } catch (error) {
      if (nativeIngress) console.error(nativeIngress.diagnostics());
      const gateway = names.find((name) => name.includes('-ingress-'));
      if (gateway) {
        const logs = await docker(['logs', '--tail', '16', gateway]);
        console.error(
          (logs.stdout + logs.stderr).replaceAll(password, '[redacted]')
        );
      }
      throw error;
    } finally {
      for (const service of processes.reverse()) await service.stop();
      if (source?.isInitialized) await source.destroy();
      if (credentialSource?.isInitialized) await credentialSource.destroy();
      for (const name of names.reverse()) {
        await docker(['stop', '--time', '3', name]);
        await docker(['rm', '--volumes', name]);
      }
      if (mysqlImageBuilt) await docker(['image', 'rm', mysqlImage]);
      rmSync(directory, { recursive: true, force: true });
    }
  }
);
