/* Checks checked-in static-server configs in disposable containers using an existing local image. */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

async function main() {
  const evidence = [];
  const bundle = path.join(
    root,
    'dist/apps/portals/aggregator/entrypoints/csr'
  );
  for (const [config, destination] of [
    [
      'apps/portals/aggregator/entrypoints/csr/nginx.conf',
      '/etc/nginx/nginx.conf',
    ],
    ['deploy/local/nginx/frontend.conf', '/etc/nginx/conf.d/default.conf'],
  ]) {
    const name = `wapps-email-action-static-${randomUUID()}`;
    let started = false;
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
          '--memory=128m',
          '--cpus=0.5',
          '--publish',
          '127.0.0.1::80',
          '--volume',
          `${bundle}:/usr/share/nginx/html:ro`,
          '--volume',
          `${path.join(root, config)}:${destination}:ro`,
          'nginx:1.28-alpine',
        ],
        { stdio: 'pipe' }
      );
      started = true;
      const port = Number(
        execFileSync(
          'docker',
          [
            'inspect',
            '--format',
            '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}',
            name,
          ],
          { encoding: 'utf8' }
        ).trim()
      );
      assert.ok(Number.isInteger(port) && port > 0);
      const origin = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          const response = await fetch(`${origin}/health`, {
            signal: AbortSignal.timeout(500),
          });
          await response.arrayBuffer();
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {
          /* Local startup is bounded. */
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(
        ready,
        'Static server must start with the checked-in configuration'
      );
      const secret = `disposable-action-${randomUUID()}`;
      const response = await fetch(
        `${origin}/auth/action?mode=verifyEmail&oobCode=${secret}`
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const html = await response.text();
      assert.ok(html.includes('name="referrer" content="no-referrer"'));
      assert.equal(html.includes(secret), false);
      if (config.endsWith('/csr/nginx.conf')) {
        const other = await fetch(`${origin}/?oobCode=${secret}`, {
          headers: { referer: `${origin}/auth/action?oobCode=${secret}` },
        });
        await other.arrayBuffer();
      }
      const logs = execFileSync('docker', ['logs', name], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      assert.equal(
        logs.includes(secret),
        false,
        'Static access logs must not retain the action query or referrer'
      );
      evidence.push({
        config,
        image: 'nginx:1.28-alpine',
        actionStatus: 200,
        referrerPolicy: 'no-referrer',
        cacheControl: 'no-store',
        actionSecretInLogs: false,
      });
    } finally {
      if (started)
        execFileSync('docker', ['stop', '--time', '5', name], {
          stdio: 'pipe',
        });
    }
  }
  const output =
    process.env.WAPPS_EMAIL_ACTION_STATIC_OUTPUT ??
    '/tmp/wapps-readiness/email-action-static.json';
  fs.writeFileSync(output, JSON.stringify({ evidence }, null, 2));
  console.log(
    'Both static Nginx configurations serve email actions, suppress action logging and prevent referrer propagation.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
