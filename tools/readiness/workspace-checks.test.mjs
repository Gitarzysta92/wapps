import assert from 'node:assert/strict';
import test from 'node:test';
import { testInventory, validateJestResult } from './workspace-checks.mjs';

const graph = {
  nodes: {
    app: { data: { root: 'apps/test', targets: { test: { executor: '@nx/jest:jest', options: { passWithNoTests: false } } } } },
    empty: { data: { root: 'libs/empty', targets: {} } },
  },
};
const files = ['apps/test/src/usecase.spec.ts'];
const gaps = { empty: 'Coverage pending' };

test('inventories every spec and explicit coverage gap', () => {
  const result = testInventory(graph, [...files, 'tools/readiness/authorization.test.cjs', 'tools/readiness/identity-recovery.test.cjs'], gaps);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.tests[0].files, files);
  assert.equal(result.portable.length, 1);
  assert.equal(result.qualification.length, 1);
});

test('fails on unowned specs, missing test targets and empty target success', () => {
  assert.match(testInventory(graph, [...files, 'elsewhere/test.spec.ts'], gaps).errors.join('\n'), /Unowned test/);
  assert.match(testInventory(graph, [...files, 'libs/empty/example.spec.ts'], gaps).errors.join('\n'), /explicit Jest/);
  assert.match(testInventory(graph, [], gaps).errors.join('\n'), /empty test target/);
  const invalid = structuredClone(graph);
  invalid.nodes.app.data.targets.test.options.passWithNoTests = true;
  assert.match(testInventory(invalid, files, gaps).errors.join('\n'), /empty tests must fail/);
});

test('fails when a new uncovered project or a stale gap is not acknowledged', () => {
  assert.match(testInventory(graph, files, {}).errors.join('\n'), /missing documented/);
  assert.match(testInventory(graph, files, { ...gaps, removed: 'old' }).errors.join('\n'), /project does not exist/);
  assert.match(testInventory(graph, files, { ...gaps, app: 'old' }).errors.join('\n'), /specs now exist/);
});

test('requires actual execution of every inventoried suite with no skips or todos', () => {
  const result = { success: true, numPassedTests: 2, testResults: [{ name: '/workspace/apps/test/src/usecase.spec.ts' }] };
  assert.doesNotThrow(() => validateJestResult(result, files, '/workspace'));
  for (const key of ['numFailedTests', 'numPendingTests', 'numTodoTests', 'numFailedTestSuites', 'numPendingTestSuites']) {
    assert.throws(() => validateJestResult({ ...result, [key]: 1 }, files, '/workspace'), /must pass/);
  }
  assert.throws(() => validateJestResult({ ...result, numPassedTests: 0 }, files, '/workspace'), /must pass/);
  assert.throws(() => validateJestResult(result, [...files, 'apps/test/src/omitted.spec.ts'], '/workspace'), /differs from inventory/);
});
