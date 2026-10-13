const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wapps-media-gateway-')
  );
  const name = 'wapps-media-gateway-' + randomUUID();
  const hosts = [
    'firebase-auth-validator',
    'editorial',
    'account-management',
    'catalog-bff',
    'discussion',
    'content-node-registry',
    'aggregator-csr',
    'discussion-csr',
    'catalog-csr',
  ];
  const mappings = hosts.flatMap((host) => ['--add-host', host + ':127.0.0.2']);
  const mounts = [
    '-v',
    path.join(root, 'deploy/local/nginx') + ':/etc/nginx/local:ro',
  ];
  const docker = (args) =>
    execFileSync('docker', args, { encoding: 'utf8', timeout: 30000 });
  docker([
    'run',
    '--rm',
    ...mappings,
    ...mounts,
    '-v',
    path.join(root, 'deploy/local/nginx/gateway.conf') +
      ':/etc/nginx/conf.d/default.conf:ro',
    'nginx:1.28-alpine',
    'nginx',
    '-t',
  ]);
  fs.writeFileSync(
    path.join(directory, 'nginx.conf'),
    `events {}
http {
  include /etc/nginx/local/gateway.conf;
  server {
    listen 127.0.0.2:8080;
    location / { add_header X-User-Id gateway-user always; add_header X-User-Claims '{"tenantId":"default","roles":[]}' always; add_header X-Ingress-Auth qualification always; return 204; }
  }
  server {
    listen 127.0.0.2:1337;
    add_header X-Test-Backend editorial always;
    add_header X-Test-Identity $http_x_user_id always;
    add_header X-Test-Claims $http_x_user_claims always;
    add_header X-Test-Ingress $http_x_ingress_auth always;
    location / { return 200 'editorial'; }
  }
  server {
    listen 127.0.0.2:1340;
    add_header X-Test-Backend account always;
    add_header X-Test-Identity $http_x_user_id always;
    add_header X-Test-Ingress $http_x_ingress_auth always;
    location / { return 200 'account'; }
  }
  server { listen 127.0.0.2:3000; location / { return 200 'catalog'; } }
  server {
    listen 127.0.0.2:1338;
    add_header X-Test-Backend discussion always;
    add_header X-Test-Identity $http_x_user_id always;
    add_header X-Test-Ingress $http_x_ingress_auth always;
    location / { return 200 'discussion'; }
  }
}`
  );
  let started = false;
  try {
    docker([
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      ...mappings,
      ...mounts,
      '-v',
      path.join(directory, 'nginx.conf') + ':/etc/nginx/nginx.conf:ro',
      '-p',
      '127.0.0.1::4200',
      '-p',
      '127.0.0.1::1337',
      '-p',
      '127.0.0.1::1338',
      'nginx:1.28-alpine',
    ]);
    started = true;
    const origin = 'http://' + docker(['port', name, '4200/tcp']).trim();
    const editorialOrigin =
      'http://' + docker(['port', name, '1337/tcp']).trim();
    const discussionOrigin =
      'http://' + docker(['port', name, '1338/tcp']).trim();
    for (let attempt = 0; ; attempt++) {
      try {
        assert.equal(
          (
            await fetch(origin + '/health', {
              signal: AbortSignal.timeout(1000),
            })
          ).status,
          200
        );
        break;
      } catch (error) {
        if (attempt >= 30) throw error;
        await delay(100);
      }
    }
    for (const [upstream, route] of [
      [editorialOrigin, '/api/internal/profile-totals'],
      [discussionOrigin, '/api/internal/profile-totals'],
      [editorialOrigin, '/api/internal/profile-articles'],
      [editorialOrigin, '/api/internal/profile-articles/?after=x'],
      [editorialOrigin, '/api/internal/profile-suites'],
      [editorialOrigin, '/api/internal/profile-suites/?after=x'],
      [discussionOrigin, '/api/internal/profile-discussions'],
      [discussionOrigin, '/api/internal/profile-discussions/?after=x'],
    ]) {
      const response = await fetch(upstream + route, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-profile-reader': 'qualification',
        },
        body: JSON.stringify({ ownerIdentityId: 'gateway-user', after: null }),
        signal: AbortSignal.timeout(3000),
      });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get('x-test-backend'), null);
    }
    console.log(
      'PASS: public Editorial and Discussion gateways block internal profile collection reads before backend routing'
    );
    for (const [method, route] of [
      [
        'GET',
        '/api/profiles/00000000-0000-4000-8000-000000000001/articles?after=00000000-0000-4000-8000-000000000002',
      ],
      ['GET', '/api/me/totals'],
      ['GET', '/api/profiles/00000000-0000-4000-8000-000000000001/totals'],
      ['GET', '/api/admin/profile-badges'],
      ['GET', '/api/admin/profile-badges/id?after=20'],
      ['PUT', '/api/admin/profile-badges/id'],
      ['GET', '/api/me/badges'],
      ['GET', '/api/profiles/id/badges'],
    ]) {
      const response = await fetch(origin + route, {
        method,
        headers: { 'x-user-id': 'spoofed', 'x-ingress-auth': 'spoofed' },
        signal: AbortSignal.timeout(3000),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-test-backend'), 'account');
      assert.equal(response.headers.get('x-test-identity'), 'gateway-user');
      assert.equal(response.headers.get('x-test-ingress'), 'qualification');
    }
    console.log(
      'PASS: badge staff, own and public routes reach Account with trusted ingress identity'
    );
    for (const route of [
      '/api/me/application-images',
      '/api/me/article-covers',
      '/api/me/articles/id/submissions/1/cover',
      '/api/editorial/article-reviews/id/submissions/1/cover',
      '/api/me/application-drafts/id/images/logo/content',
      '/api/editorial/application-reviews/id/submissions/1/images/logo/content',
      '/api/me/articles',
      '/api/me/articles/id/submit',
      '/api/editorial/article-reviews/id/decision',
      '/api/catalog/articles?page=2&tag=offline',
      '/api/catalog/articles/example',
      '/api/catalog/article-selection?ids=example',
      '/api/catalog/article-visibility/id',
      '/api/catalog/application-visibility/id',
      '/api/me/releases',
      '/api/me/releases/id/submit',
      '/api/editorial/release-reviews/id/decision',
      '/api/catalog/releases/example?page=2&channel=stable',
      '/api/catalog/releases/example/1.0%2Bnext',
    ]) {
      const response = await fetch(origin + route, {
        headers: {
          'x-user-id': 'spoofed',
          'x-user-claims': 'spoofed',
          'x-ingress-auth': 'spoofed',
        },
        signal: AbortSignal.timeout(3000),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-test-backend'), 'editorial');
      assert.equal(response.headers.get('x-test-identity'), 'gateway-user');
      assert.equal(response.headers.get('x-test-ingress'), 'qualification');
    }
    for (const [method, route] of [
      ['GET', '/api/me/discussions'],
      ['GET', '/api/discussion-selection?ids=example'],
      ['GET', '/api/application-discussions/application'],
      ['POST', '/api/application-discussions/application'],
      ['POST', '/api/application-discussions/application/topic/replies'],
      ['PUT', '/api/application-discussions/application/topic'],
      ['DELETE', '/api/application-discussions/application/topic'],
      ['GET', '/api/article-comments/article'],
      ['POST', '/api/article-comments/article'],
      ['POST', '/api/article-comments/article/comment/replies'],
      ['PUT', '/api/article-comments/article/comment'],
      ['DELETE', '/api/article-comments/article/comment'],
    ]) {
      const response = await fetch(origin + route, {
        method,
        headers: { 'x-user-id': 'spoofed', 'x-ingress-auth': 'spoofed' },
        signal: AbortSignal.timeout(3000),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-test-backend'), 'discussion');
      assert.equal(response.headers.get('x-test-identity'), 'gateway-user');
      assert.equal(response.headers.get('x-test-ingress'), 'qualification');
    }
    for (const route of [
      '/api/article-comments/article',
      '/api/application-discussions/application',
    ]) {
      assert.equal(
        (
          await fetch(origin + route, {
            method: 'POST',
            body: Buffer.alloc(32 * 1024 + 1),
            signal: AbortSignal.timeout(5000),
          })
        ).status,
        413
      );
    }
    for (const route of [
      '/api/media/applications/id/logo/image',
      '/api/media/articles/id/image',
    ]) {
      const response = await fetch(origin + route, {
        headers: {
          'x-user-id': 'spoofed',
          'x-user-claims': 'spoofed',
          'x-ingress-auth': 'spoofed',
        },
        signal: AbortSignal.timeout(3000),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-test-backend'), 'editorial');
      for (const header of [
        'x-test-identity',
        'x-test-claims',
        'x-test-ingress',
      ])
        assert.equal(response.headers.get(header), null);
    }
    for (const kind of ['application-images', 'article-covers']) {
      const oversize = await fetch(origin + '/api/me/' + kind + '/id/content', {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: Buffer.alloc(8 * 1024 * 1024 + 1),
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(oversize.status, 413);
    }
    assert.equal(
      await (await fetch(origin + '/api/me/profile')).text(),
      'account'
    );
    assert.equal(
      await (await fetch(origin + '/api/catalog/apps')).text(),
      'catalog'
    );
    console.log(
      'PASS: full local gateway syntax; media, article, comment and release API routing; private identity-header replacement; public media header stripping; 8 MiB media and 32 KiB comment body limits; existing account/catalog routing'
    );
    console.log(
      'LIMIT: nginx uses fixture authentication and upstreams; production ingress/session validation remains unqualified'
    );
  } finally {
    if (started) docker(['rm', '-f', name]);
    fs.rmSync(directory, { recursive: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
