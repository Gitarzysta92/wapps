import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundleDirectory = resolve(
  root,
  'sdk/features/identity/packages/infrastructure/opa/bundles'
);
const opa = process.env.OPA_BINARY ?? 'opa';

test('deployed OPA bundles deny malformed input and preserve role separation after merging', () => {
  const policies = mkdtempSync(join(tmpdir(), 'wapps-opa-'));
  try {
    execFileSync(process.execPath, ['deploy/local/opa/merge-data.mjs'], {
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
      copyFileSync(
        join(path, 'policy_test.rego'),
        join(policies, `${name}_test.rego`)
      );
    }
    const data = JSON.parse(readFileSync(join(policies, 'data.json'), 'utf8'));
    assert.deepEqual(data.authority.roles_by_identity, {});
    execFileSync(opa, ['check', '--strict', policies]);
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
