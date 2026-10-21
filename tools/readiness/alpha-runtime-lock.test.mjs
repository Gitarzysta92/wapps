import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLockedPackages, seedRuntimeLock } from '../../deploy/alpha/prepare-runtime-lock.mjs';

const manifest = { name: 'runtime', version: '1.0.0', dependencies: { parent: '1.0.0' } };
const rootLock = {
  lockfileVersion: 3,
  packages: {
    '': { name: 'workspace', devDependencies: { tool: '1.0.0' } },
    'node_modules/parent': { version: '1.0.0', resolved: 'https://registry.npmjs.org/parent/-/parent-1.0.0.tgz', integrity: 'sha512-parent' },
    'node_modules/parent/node_modules/nested': { version: '2.0.0', resolved: 'https://registry.npmjs.org/nested/-/nested-2.0.0.tgz', integrity: 'sha512-nested' },
  },
};

test('runtime lock preserves nested workspace resolutions and removes root development requirements', () => {
  const lock = seedRuntimeLock(rootLock, manifest);
  assert.deepEqual(lock.packages[''], manifest);
  assert.deepEqual(lock.packages['node_modules/parent/node_modules/nested'], rootLock.packages['node_modules/parent/node_modules/nested']);
  assert.equal(rootLock.packages[''].name, 'workspace');
  assertLockedPackages(rootLock, lock);
});

test('runtime package pruning cannot change versions, sources or integrity', () => {
  for (const key of ['version', 'resolved', 'integrity']) {
    const lock = seedRuntimeLock(rootLock, manifest);
    lock.packages['node_modules/parent'][key] = 'unexpected';
    assert.throws(() => assertLockedPackages(rootLock, lock), /differs from the workspace lock/);
  }
});

test('runtime lock rejects newly resolved packages and filesystem links', () => {
  const added = seedRuntimeLock(rootLock, manifest);
  added.packages['node_modules/unpinned'] = { version: '1.0.0' };
  assert.throws(() => assertLockedPackages(rootLock, added), /differs from the workspace lock/);
  const linked = seedRuntimeLock(rootLock, manifest);
  linked.packages['node_modules/parent'].link = true;
  assert.throws(() => assertLockedPackages(rootLock, linked), /differs from the workspace lock/);
});
