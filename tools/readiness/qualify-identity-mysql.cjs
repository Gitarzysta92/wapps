/* Uses an existing local image and an ephemeral database; never mounts Wapps data volumes. */
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createConnection } = require('mysql2/promise');
const path = require('node:path');

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 &&
      ![
        '--account-erasure-cleanup',
        '--account-erasure-coordinator',
        '--identity-write-barriers',
        '--account-export-storage',
        '--profile-browser',
        '--profile-avatars-browser',
        '--public-profiles-browser',
        '--profile-badges-browser',
        '--email-verification-browser',
      ].includes(args[0]))
  )
    throw new Error(
      'Expected no arguments, --account-erasure-cleanup, --account-erasure-coordinator, --identity-write-barriers, --account-export-storage, --profile-browser, --profile-avatars-browser, --public-profiles-browser, --profile-badges-browser or --email-verification-browser'
    );
  const profileBrowser = [
    '--profile-browser',
    '--profile-avatars-browser',
    '--public-profiles-browser',
    '--profile-badges-browser',
  ].includes(args[0]);
  const emailVerificationBrowser = args[0] === '--email-verification-browser';
  const name = `wapps-identity-qualification-${randomUUID()}`;
  const password = randomUUID();
  let started = false;
  let stopped = false;
  function cleanup() {
    if (started && !stopped) {
      stopped = true;
      execFileSync('docker', ['stop', '--time', '10', name], { stdio: 'pipe' });
    }
  }
  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
  try {
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--detach',
        '--pull=never',
        '--name',
        name,
        '--memory=768m',
        '--cpus=1',
        '--tmpfs',
        '/var/lib/mysql:rw,size=512m',
        '--publish',
        '127.0.0.1::3306',
        '--env',
        'MYSQL_ROOT_PASSWORD',
        'mysql:8.4',
      ],
      { env: { ...process.env, MYSQL_ROOT_PASSWORD: password }, stdio: 'pipe' }
    );
    started = true;
    const port = Number(
      execFileSync(
        'docker',
        [
          'inspect',
          '--format',
          '{{(index (index .NetworkSettings.Ports "3306/tcp") 0).HostPort}}',
          name,
        ],
        { encoding: 'utf8' }
      ).trim()
    );
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error('Invalid qualification port');
    let ready = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      try {
        const connection = await createConnection({
          host: '127.0.0.1',
          port,
          user: 'root',
          password,
          connectTimeout: 1000,
        });
        await connection.end();
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (!ready) throw new Error('Ephemeral MySQL did not become ready');
    console.log(
      'Running qualification against ephemeral MySQL 8.4; no existing database is targeted.'
    );
    process.exitCode = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        ['--test', path.join(__dirname, 'identity-recovery.test.cjs')],
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            WAPPS_IDENTITY_INTEGRATION: '1',
            WAPPS_ACCOUNT_ERASURE_CLEANUP:
              args[0] === '--account-erasure-cleanup' ? '1' : '0',
            WAPPS_ACCOUNT_ERASURE_COORDINATOR:
              args[0] === '--account-erasure-coordinator' ? '1' : '0',
            WAPPS_IDENTITY_WRITE_BARRIERS:
              args[0] === '--identity-write-barriers' ? '1' : '0',
            WAPPS_ACCOUNT_EXPORT_STORAGE:
              args[0] === '--account-export-storage' ? '1' : '0',
            WAPPS_PROFILE_BROWSER: profileBrowser ? '1' : '0',
            WAPPS_PROFILE_AVATARS_ONLY:
              args[0] === '--profile-avatars-browser' ? '1' : '0',
            WAPPS_PUBLIC_PROFILES_ONLY:
              args[0] === '--public-profiles-browser' ? '1' : '0',
            WAPPS_PROFILE_BADGES_ONLY:
              args[0] === '--profile-badges-browser' ? '1' : '0',
            WAPPS_EMAIL_VERIFICATION_BROWSER: emailVerificationBrowser
              ? '1'
              : '0',
            IDENTITY_TEST_MYSQL_PORT: String(port),
            IDENTITY_TEST_MYSQL_USERNAME: 'root',
            IDENTITY_TEST_MYSQL_PASSWORD: password,
          },
        }
      );
      child.once('error', () => resolve(1));
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Qualification failed'
  );
  process.exitCode = 1;
});
