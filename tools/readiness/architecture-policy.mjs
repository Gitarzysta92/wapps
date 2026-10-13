export const architectureDependencies = {
  kernel: ['kernel'],
  platform: ['kernel', 'platform'],
  domain: ['kernel', 'domain', 'platform'],
  usecase: ['kernel', 'domain', 'platform', 'usecase'],
  adapter: ['kernel', 'domain', 'platform', 'usecase', 'adapter'],
  contracts: ['kernel', 'domain', 'contracts'],
  data: ['kernel', 'domain', 'data'],
  service: ['kernel', 'domain', 'platform', 'usecase', 'adapter', 'contracts', 'data'],
  ui: ['kernel', 'ui'],
  boundary: ['kernel', 'domain', 'ui', 'boundary'],
  'portal-support': ['kernel', 'domain', 'ui', 'boundary', 'portal-support'],
  feature: ['kernel', 'domain', 'usecase', 'ui', 'boundary', 'portal-support', 'feature'],
  portal: ['kernel', 'domain', 'ui', 'boundary', 'portal-support', 'feature'],
  entrypoint: ['portal'],
  tooling: ['kernel', 'platform', 'domain', 'usecase', 'adapter', 'contracts', 'data', 'service', 'ui', 'boundary', 'portal-support', 'feature', 'portal', 'entrypoint', 'tooling'],
};

// Responsibilities follow the repository layout; legacy type/scope tags are descriptive only.
export function architectureForRoot(root) {
  if (root === '.' || root.startsWith('tools/')) return 'tooling';
  if (root.startsWith('sdk/kernel/')) return 'kernel';
  if (root.startsWith('sdk/platform/')) return 'platform';
  if (root.startsWith('libs/domains/') || /^sdk\/features\/[^/]+\/core$/.test(root)) return 'domain';
  if (/^sdk\/features\/[^/]+\/libs\//.test(root)) return 'usecase';
  if (root.startsWith('sdk/extras/') || /^sdk\/features\/[^/]+\/packages\/infrastructure\//.test(root)) return 'adapter';
  if (root === 'apps/shared') return 'contracts';
  if (root === 'data') return 'data';
  if (/^apps\/(services|agents|scrappers)\//.test(root) || /^sdk\/features\/[^/]+\/applications\//.test(root)) return 'service';
  if (root.startsWith('libs/ui/')) return 'ui';
  if (root.startsWith('apps/portals/shared/boundary/')) return 'boundary';
  if (root === 'apps/portals/shared/data' || root.startsWith('apps/portals/shared/cross-cutting/')) return 'portal-support';
  if (root.startsWith('apps/portals/shared/features/')) return 'feature';
  if (/^apps\/portals\/[^/]+\/application$/.test(root)) return 'portal';
  if (/^apps\/portals\/[^/]+\/entrypoints\//.test(root)) return 'entrypoint';
  throw new Error(`No architecture responsibility assigned to ${root}`);
}

export const architectureConstraints = Object.entries(architectureDependencies).map(
  ([source, targets]) => ({
    sourceTag: `arch:${source}`,
    onlyDependOnLibsWithTags: targets.map((target) => `arch:${target}`),
    ...(['kernel', 'domain'].includes(source) ? {
      bannedExternalImports: ['@angular/*', '@nestjs/*', 'typeorm', 'mongodb', 'mysql2', 'mysql2/*', 'amqplib', 'firebase-admin', 'firebase-admin/*', '@aws-sdk/*'],
    } : {}),
  })
);

export function auditProjectBoundaries(graph) {
  const findings = [];
  for (const [name, node] of Object.entries(graph.nodes)) {
    const responsibility = architectureForRoot(node.data.root);
    const tags = (node.data.tags || []).filter((tag) => tag.startsWith('arch:'));
    if (tags.length !== 1 || tags[0] !== `arch:${responsibility}`) {
      findings.push(`${name}: expected only arch:${responsibility}, got ${tags.join(', ') || 'none'}`);
    }
    for (const dependency of graph.dependencies[name] || []) {
      const target = graph.nodes[dependency.target];
      if (!target || dependency.target === name) continue;
      const targetResponsibility = architectureForRoot(target.data.root);
      if (!architectureDependencies[responsibility].includes(targetResponsibility)) {
        findings.push(`${name} (${responsibility}) -> ${dependency.target} (${targetResponsibility})`);
      }
    }
  }
  return findings;
}
