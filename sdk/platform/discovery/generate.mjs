import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args.set(key, true);
      } else {
        args.set(key, next);
        i++;
      }
    }
  }
  return args;
}

function environmentToFolder(environment) {
  switch (environment) {
    case 'development':
    case 'dev':
      return 'dev';
    case 'production':
    case 'prod':
      return 'prod';
    default:
      // fall back to development layout
      return 'dev';
  }
}

function titleCaseFromId(id) {
  return id
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function parseIngressLikeYaml(text) {
  const lines = text.split(/\r?\n/);
  /** @type {Map<string, Set<string>>} */
  const hostToPaths = new Map();
  let currentHost = null;

  for (const line of lines) {
    const hostMatch = line.match(/^\s*-\s*host:\s*([^\s#]+)/);
    if (hostMatch) {
      currentHost = hostMatch[1].trim();
      if (!hostToPaths.has(currentHost)) hostToPaths.set(currentHost, new Set());
      continue;
    }

    const pathMatch = line.match(/^\s*-\s*path:\s*([^\s#]+)/);
    if (pathMatch && currentHost) {
      const p = pathMatch[1].trim();
      hostToPaths.get(currentHost)?.add(p.startsWith('/') ? p : `/${p}`);
    }
  }

  // Default to "/" if host exists but no paths were found
  for (const [host, paths] of hostToPaths) {
    if (paths.size === 0) paths.add('/');
    // Skip placeholder hosts
    if (host.includes('placeholder')) hostToPaths.delete(host);
  }

  return hostToPaths;
}

function urlsFromHostToPaths(hostToPaths) {
  /** @type {string[]} */
  const urls = [];
  for (const [host, paths] of hostToPaths) {
    for (const p of paths) {
      if (p === '/' || p === '') urls.push(`https://${host}/`);
      else urls.push(`https://${host}${p}`);
    }
  }
  return Array.from(new Set(urls)).sort();
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function listIngressPatchFiles(workspaceRoot, envFolder) {
  const appsDir = path.join(workspaceRoot, 'environments', envFolder, 'apps');
  let entries = [];
  try {
    entries = fs.readdirSync(appsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  /** @type {string[]} */
  const files = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const candidate = path.join(appsDir, e.name, 'ingress-patch.yaml');
    if (fs.existsSync(candidate)) files.push(candidate);
  }
  return files.sort();
}

function parseArgoCdHostFromKustomize(workspaceRoot, envFolder) {
  const kustomizePath = path.join(
    workspaceRoot,
    'environments',
    envFolder,
    'platform',
    'argocd-kustomization',
    'kustomization.yaml'
  );
  const text = readIfExists(kustomizePath);
  if (!text) return null;

  // Looks like: value: argocd.development.wapps.ai
  const m = text.match(/^\s*value:\s*([^\s#]+)\s*$/m);
  if (!m) return null;

  return { host: m[1].trim(), source: kustomizePath };
}

function main() {
  const args = parseArgs(process.argv);
  const environment = String(args.get('environment') || args.get('env') || 'development');
  const envFolder = environmentToFolder(environment);

  const workspaceRoot = process.cwd();
  const outPath = path.resolve(
    workspaceRoot,
    String(
      args.get('out') ||
        'apps/portals/aggregator-demo/entrypoints/csr/src/assets/service-directory.json'
    )
  );

  /** @type {Array<{id: string, name: string, urls: string[], sources: string[]}>} */
  const services = [];
  /** @type {string[]} */
  const sources = [];

  const ingressFiles = listIngressPatchFiles(workspaceRoot, envFolder);
  for (const filePath of ingressFiles) {
    const text = fs.readFileSync(filePath, 'utf8');
    const hostToPaths = parseIngressLikeYaml(text);
    const urls = urlsFromHostToPaths(hostToPaths);
    if (urls.length === 0) continue;

    const dirName = path.basename(path.dirname(filePath));
    const id = dirName.replace(/-kustomization$/, '');
    services.push({
      id,
      name: titleCaseFromId(id),
      urls,
      sources: [path.relative(workspaceRoot, filePath)],
    });
    sources.push(path.relative(workspaceRoot, filePath));
  }

  const argo = parseArgoCdHostFromKustomize(workspaceRoot, envFolder);
  if (argo?.host) {
    services.push({
      id: 'argocd',
      name: 'Argo CD',
      urls: [`https://${argo.host}/`],
      sources: [path.relative(workspaceRoot, argo.source)],
    });
    sources.push(path.relative(workspaceRoot, argo.source));
  }

  services.sort((a, b) => a.id.localeCompare(b.id));

  const payload = {
    generatedAt: new Date().toISOString(),
    environment,
    sources: Array.from(new Set(sources)).sort(),
    services,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `✅ Generated ${services.length} service entries for ${environment} -> ${path.relative(
      workspaceRoot,
      outPath
    )}`
  );
}

main();

