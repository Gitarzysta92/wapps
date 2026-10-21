import assert from 'node:assert/strict';
import test from 'node:test';
import { architectureConstraints, auditProjectBoundaries } from './architecture-policy.mjs';

const node = (root, tag) => ({ data: { root, tags: [`arch:${tag}`] } });
const graph = {
  nodes: {
    domain: node('libs/domains/catalog/record', 'domain'),
    kernel: node('sdk/kernel/standard', 'kernel'),
    adapter: node('sdk/extras/mysql', 'adapter'),
    ui: node('libs/ui/form', 'ui'),
    feature: node('apps/portals/shared/features/listing', 'feature'),
    portal: node('apps/portals/aggregator/application', 'portal'),
  },
  dependencies: {},
};

test('enforces responsibility tags, including newly added or incorrectly tagged projects', () => {
  assert.deepEqual(auditProjectBoundaries(graph), []);
  const invalid = structuredClone(graph);
  invalid.nodes.domain.data.tags = ['type:domain'];
  assert.match(auditProjectBoundaries(invalid).join('\n'), /expected only arch:domain/);
  invalid.nodes.domain.data.tags = ['arch:tooling'];
  assert.match(auditProjectBoundaries(invalid).join('\n'), /expected only arch:domain/);
  assert.throws(() => auditProjectBoundaries({ nodes: { unknown: node('unknown', 'tooling') }, dependencies: {} }), /No architecture responsibility/);
});

test('rejects domain adapters, kernel domains, UI features and shared concrete portals', () => {
  const invalid = structuredClone(graph);
  invalid.dependencies = {
    domain: [{ target: 'adapter' }],
    kernel: [{ target: 'domain' }],
    ui: [{ target: 'feature' }],
    feature: [{ target: 'portal' }],
  };
  assert.equal(auditProjectBoundaries(invalid).length, 4);
  const valid = structuredClone(graph);
  valid.dependencies = { portal: [{ target: 'feature' }], feature: [{ target: 'domain' }], domain: [{ target: 'kernel' }], adapter: [{ target: 'domain' }] };
  assert.deepEqual(auditProjectBoundaries(valid), []);
});

test('ESLint enforces the same matrix without a wildcard fallback', () => {
  assert.equal(architectureConstraints.find((rule) => rule.sourceTag === 'arch:domain').onlyDependOnLibsWithTags.includes('arch:adapter'), false);
  assert.equal(architectureConstraints.some((rule) => rule.sourceTag === '*' || rule.onlyDependOnLibsWithTags.includes('*')), false);
  assert.ok(architectureConstraints.find((rule) => rule.sourceTag === 'arch:domain').bannedExternalImports.includes('mysql2'));
});
