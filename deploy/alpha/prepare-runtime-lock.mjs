import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function seedRuntimeLock(rootLock, manifest) {
  const lock = structuredClone(rootLock);
  if (lock.lockfileVersion !== 3 || !lock.packages?.['']) {
    throw new Error('A complete version-3 workspace lockfile is required');
  }
  lock.name = manifest.name;
  lock.version = manifest.version;
  lock.packages[''] = manifest;
  return lock;
}

export function assertLockedPackages(rootLock, runtimeLock) {
  for (const [location, entry] of Object.entries(runtimeLock.packages)) {
    if (!location) continue;
    const original = rootLock.packages[location];
    if (!original || entry.link || ['version', 'resolved', 'integrity'].some(
      (key) => entry[key] !== original[key]
    )) {
      throw new Error(`Runtime dependency differs from the workspace lock: ${location}`);
    }
  }
}

export function prepareRuntimeLock(rootLockPath, outputDirectory) {
  const rootLock = JSON.parse(readFileSync(rootLockPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(path.join(outputDirectory, 'package.json'), 'utf8'));
  const target = path.join(outputDirectory, 'package-lock.json');
  writeFileSync(target, JSON.stringify(seedRuntimeLock(rootLock, manifest), null, 2) + '\n');
  // Let npm prune the complete locked graph; Nx's pruned graph can lose nested packages.
  const result = spawnSync('npm', [
    'install', '--package-lock-only', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
  ], { cwd: outputDirectory, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`Runtime lock preparation failed: ${result.status}`);
  }
  const runtimeLock = JSON.parse(readFileSync(target, 'utf8'));
  assertLockedPackages(rootLock, runtimeLock);
  console.log(`Verified ${Object.keys(runtimeLock.packages).length - 1} workspace-pinned runtime packages`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: prepare-runtime-lock.mjs ROOT_LOCK OUTPUT_DIRECTORY');
  prepareRuntimeLock(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
}
