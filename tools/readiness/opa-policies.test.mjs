import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundleDirectory = resolve(
  root,
  'sdk/features/identity/packages/infrastructure/opa/bundles'
);
const opa = process.env.OPA_BINARY ?? 'opa';

for (const merger of [
  'deploy/local/opa/merge-data.mjs',
  'deploy/alpha/merge-policy-data.mjs',
])
  test(`deployed OPA bundles preserve authorization after ${merger}`, () => {
    const policies = mkdtempSync(join(tmpdir(), 'wapps-opa-'));
    try {
      execFileSync(process.execPath, [merger], {
        cwd: root,
        env: {
          ...process.env,
          OPA_BUNDLE_DIRECTORY: bundleDirectory,
          OPA_POLICY_DIRECTORY: policies,
        },
      });
      for (const name of ['editorial', 'discussion', 'identity-admin']) {
        const path = join(bundleDirectory, name);
        execFileSync(opa, ['check', '--strict', path]);
        execFileSync(opa, ['test', path, '--verbose']);
        for (const file of readdirSync(path)) {
          if (file.endsWith('_test.rego'))
            copyFileSync(join(path, file), join(policies, `${name}-${file}`));
        }
      }
      const data = JSON.parse(
        readFileSync(join(policies, 'data.json'), 'utf8')
      );
      assert.deepEqual(data.authority.roles_by_identity, {});
      execFileSync(opa, ['check', '--strict', policies]);
      // A missing package returns an undefined decision, not false. Check deployed decisions too.
      for (const [visibility, expected] of [
        ['public', true],
        ['private', false],
      ]) {
        const decision = JSON.parse(
          execFileSync(
            opa,
            [
              'eval',
              '--data',
              policies,
              '--stdin-input',
              '--format=json',
              'data.wapps.profile_audience.authz.allow',
            ],
            {
              encoding: 'utf8',
              input: JSON.stringify({
                ownerId: '00000000-0000-4000-8000-000000000001',
                viewerId: '00000000-0000-4000-8000-000000000002',
                ownerActive: true,
                viewerActive: true,
                viewerRegistered: true,
                approved: false,
                visibility,
                action: 'read',
              }),
            }
          )
        );
        assert.equal(decision.result?.[0]?.expressions?.[0]?.value, expected);
      }
      const result = execFileSync(opa, ['test', policies, '--verbose'], {
        encoding: 'utf8',
      });
      const counts = result.match(/PASS: (\d+)\/(\d+)/);
      assert.ok(
        counts && Number(counts[1]) > 0 && counts[1] === counts[2],
        'OPA must execute and pass nonempty policy tests'
      );
      process.stdout.write(result);
    } finally {
      rmSync(policies, { force: true, recursive: true });
    }
  });
