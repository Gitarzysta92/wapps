const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const configPath = path.join(root, 'tsconfig.base.json');
require('ts-node').register({
  project: configPath,
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
require('tsconfig-paths').register({
  baseUrl: root,
  paths: ts.readConfigFile(configPath, ts.sys.readFile).config.compilerOptions
    .paths,
});
const {
  EditorialCommands,
} = require('../../apps/services/editorial/src/app/application/editorial-commands.ts');

const actor = {
  identityId: 'readiness-test',
  tenantId: 'test',
  roles: ['editorial:publisher'],
};
const input = { name: 'Readiness test', slug: 'readiness-test' };

for (const decision of ['deny', 'unavailable', 'allow']) {
  test(`Editorial create: ${decision} policy result controls durable commit`, async () => {
    const writes = [];
    const policyResult =
      decision === 'unavailable'
        ? { ok: false, error: new Error('Policy unavailable') }
        : { ok: true, value: decision === 'allow' };
    const service = new EditorialCommands(
      {
        receipt: async () => null,
        commit: async () => {
          writes.push('atomic-commit');
          return {
            id: '00000000-0000-7000-8000-000000000001',
            revision: 1,
            projection: 'pending',
          };
        },
      },
      { evaluate: async () => policyResult },
      { generate: () => '00000000-0000-7000-8000-000000000001' }
    );
    const result = service.create('app', input, actor, 'test-key');
    if (decision === 'allow') {
      assert.equal((await result).revision, 1);
    } else {
      await assert.rejects(result);
    }
    assert.deepEqual(writes, decision === 'allow' ? ['atomic-commit'] : []);
  });
}

test('Editorial create: failed durable commit never reports success', async () => {
  const failure = new Error('Storage unavailable');
  const service = new EditorialCommands(
    {
      receipt: async () => null,
      commit: async () => {
        throw failure;
      },
    },
    { evaluate: async () => ({ ok: true, value: true }) },
    { generate: () => '00000000-0000-7000-8000-000000000001' }
  );
  await assert.rejects(
    service.create('app', input, actor, 'test-key'),
    (error) => error === failure
  );
});
