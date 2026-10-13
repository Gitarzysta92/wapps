import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditProjectBoundaries } from './architecture-policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = (filename) => JSON.parse(readFileSync(filename, 'utf8'));
const normalize = (filename) => filename.split(path.sep).join('/');
const ignored = new Set(['node_modules', 'dist', 'coverage', '.git', '.nx', 'artifacts']);

// These suites require separately provisioned, isolated dependencies. They never count as unit passes.
export const qualificationSuites = {
  'catalog-journey.test.cjs': 'Built Editorial/BFF services and isolated MySQL, MongoDB and RabbitMQ',
  'discussion-recovery.test.cjs': 'Isolated MySQL, MongoDB, RabbitMQ and object storage',
  'editorial-projection-recovery.test.cjs': 'Isolated MySQL, MongoDB and RabbitMQ',
  'editorial-recovery.test.cjs': 'Isolated MySQL',
  'identity-credentials.test.cjs': 'Local Firebase Auth emulator',
  'identity-recovery.test.cjs': 'Isolated MySQL and local Firebase Auth emulator',
  'opa-policies.test.mjs': 'Pinned OPA binary',
};

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}

export function discoverTestFiles(directory = root) {
  return ['apps', 'libs', 'sdk', 'data', 'tools'].flatMap((name) => {
    const folder = path.join(directory, name);
    return existsSync(folder) ? walk(folder) : [];
  }).filter((filename) =>
    /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(filename) ||
    /[/\\]__tests__[/\\].*\.[cm]?[jt]sx?$/.test(filename)
  ).map((filename) => normalize(path.relative(directory, filename))).sort();
}

export function testInventory(graph, files, gaps) {
  const projects = Object.entries(graph.nodes).filter(([, node]) => node.data.root !== '.');
  const byRoot = [...projects].sort((a, b) => b[1].data.root.length - a[1].data.root.length);
  const owned = new Map(projects.map(([name]) => [name, []]));
  const portable = [];
  const qualification = [];
  const errors = [];
  for (const file of files) {
    if (file.startsWith('tools/readiness/')) {
      if (qualificationSuites[file.slice('tools/readiness/'.length)]) qualification.push(file);
      else portable.push(file);
      continue;
    }
    const owner = byRoot.find(([, node]) => file.startsWith(node.data.root + '/'));
    if (!owner) errors.push(`Unowned test: ${file}`);
    else owned.get(owner[0]).push(file);
  }
  const tests = [];
  for (const [name, node] of projects) {
    const specs = owned.get(name);
    const target = node.data.targets?.test;
    if (specs.length) {
      if (gaps[name]) errors.push(`${name}: obsolete coverage gap; specs now exist`);
      if (target?.executor !== '@nx/jest:jest') errors.push(`${name}: specs require an explicit Jest test target`);
      else if (target.options?.passWithNoTests !== false || Object.values(target.configurations || {}).some((c) => c.passWithNoTests === true)) errors.push(`${name}: empty tests must fail`);
      else tests.push({ name, root: node.data.root, files: specs });
    } else {
      if (target) errors.push(`${name}: empty test target must not claim coverage`);
      if (typeof gaps[name] !== 'string' || !gaps[name].trim()) errors.push(`${name}: missing documented coverage gap`);
    }
  }
  for (const name of Object.keys(gaps)) {
    if (!owned.has(name)) errors.push(`${name}: obsolete coverage gap; project does not exist`);
  }
  if (!tests.length) errors.push('No project tests found');
  return { tests: tests.sort((a, b) => a.name.localeCompare(b.name)), portable, qualification, gaps, errors };
}

export function validateJestResult(result, expectedFiles, directory = root) {
  if (result.success !== true || !(result.numPassedTests > 0) || result.numFailedTests || result.numPendingTests || result.numTodoTests || result.numFailedTestSuites || result.numPendingTestSuites) {
    throw new Error('Tests must pass with no skipped, todo, empty or failed suites');
  }
  const actual = result.testResults.map((test) => normalize(path.relative(directory, test.name))).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expectedFiles].sort())) {
    throw new Error(`Test discovery differs from inventory. Expected ${expectedFiles.join(', ')}; ran ${actual.join(', ')}`);
  }
}

function execute(args, logfile) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false', NX_NO_CLOUD: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    child.once('error', (error) => { output += String(error); });
    child.once('close', (code, signal) => {
      writeFileSync(logfile, output);
      resolve({ code, signal, output });
    });
  });
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (!['inventory', 'test', 'lint', 'boundaries'].includes(mode) || args.length) throw new Error('Usage: node tools/readiness/workspace-checks.mjs inventory|test|lint|boundaries');
  process.env.NX_DAEMON = 'false';
  process.env.NX_ISOLATE_PLUGINS = 'false';
  process.env.NX_NO_CLOUD = 'true';
  const { createProjectGraphAsync } = await import('@nx/devkit');
  const graph = await createProjectGraphAsync();
  const boundaryErrors = auditProjectBoundaries(graph);
  if (boundaryErrors.length) throw new Error(boundaryErrors.join('\n'));
  if (mode === 'boundaries') {
    console.log(`Architecture tags and project dependencies pass for ${Object.keys(graph.nodes).length} projects.`);
    return;
  }
  const inventory = testInventory(graph, discoverTestFiles(), json(path.join(root, 'tools/readiness/test-coverage-gaps.json')));
  if (inventory.errors.length) throw new Error(inventory.errors.join('\n'));
  if (mode === 'inventory') {
    console.log(JSON.stringify(inventory, null, 2));
    return;
  }
  const base = process.env.WAPPS_CHECK_OUTPUT_DIR;
  if (base) mkdirSync(path.resolve(base), { recursive: true });
  const outputDirectory = mkdtempSync(path.join(base ? path.resolve(base) : tmpdir(), `wapps-${mode}-`));
  writeFileSync(path.join(outputDirectory, 'inventory.json'), JSON.stringify(inventory, null, 2));
  console.log(`Reports: ${outputDirectory}`);
  console.log(`${inventory.tests.length} projects with Jest suites; ${Object.keys(inventory.gaps).length} projects lack their own behavior specs; ${inventory.qualification.length} external qualification suites are not run by this gate.`);
  const nx = path.join(root, 'node_modules/nx/bin/nx.js');
  const tasks = mode === 'test' ? inventory.tests : Object.entries(graph.nodes)
    .filter(([name, node]) => node.data.root !== '.' && name !== 'wapps-recordings')
    .map(([name, node]) => ({ name, target: node.data.targets?.lint ? 'lint' : node.data.targets?.['eslint:lint'] ? 'eslint:lint' : null }));
  const missingLint = tasks.filter((task) => mode === 'lint' && !task.target);
  if (missingLint.length) throw new Error(`Missing lint targets: ${missingLint.map((task) => task.name).join(', ')}`);
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      const report = path.join(outputDirectory, `${task.name}.json`);
      const logfile = path.join(outputDirectory, `${task.name}.log`);
      const command = [nx, 'run', `${task.name}:${mode === 'test' ? 'test' : task.target}`, '--skip-nx-cache'];
      if (mode === 'test') command.push('--runInBand', '--ci', '--passWithNoTests=false', '--json', `--outputFile=${report}`);
      const outcome = await execute(command, logfile);
      let error = outcome.code !== 0 ? `exit ${outcome.code}, signal ${outcome.signal || 'none'}` : undefined;
      let counts;
      if (!error && mode === 'test') {
        try {
          const result = json(report);
          validateJestResult(result, task.files);
          counts = { tests: result.numPassedTests, suites: result.numPassedTestSuites };
        } catch (failure) { error = failure.message; }
      }
      results.push({ project: task.name, passed: !error, ...counts, error, logfile });
      console.log(`${error ? 'FAIL' : 'PASS'} ${task.name}${counts ? `: ${counts.tests} tests, ${counts.suites} suites` : ''}${error ? `: ${error}; ${logfile}` : ''}`);
    }
  }));
  if (mode === 'test') {
    const logfile = path.join(outputDirectory, 'portable-tools.log');
    const outcome = await execute(['--test', '--test-concurrency=1', '--test-reporter=tap', ...inventory.portable], logfile);
    const skipped = Number(outcome.output.match(/^# skipped (\d+)$/m)?.[1] ?? NaN);
    const todo = Number(outcome.output.match(/^# todo (\d+)$/m)?.[1] ?? NaN);
    const count = Number(outcome.output.match(/^# pass (\d+)$/m)?.[1] ?? 0);
    const passed = outcome.code === 0 && skipped === 0 && todo === 0 && count > 0;
    results.push({ project: 'portable-tools', passed, tests: count, logfile });
    console.log(`${passed ? 'PASS' : 'FAIL'} portable tools: ${count} tests; ${logfile}`);
  } else {
    const logfile = path.join(outputDirectory, 'readiness-tools.log');
    const outcome = await execute([path.join(root, 'node_modules/eslint/bin/eslint.js'), 'tools/readiness'], logfile);
    results.push({ project: 'readiness-tools', passed: outcome.code === 0, logfile });
    console.log(`${outcome.code === 0 ? 'PASS' : 'FAIL'} readiness tool lint; ${logfile}`);
  }
  const summary = { mode, results, coverageGaps: inventory.gaps, unrunQualification: inventory.qualification, fullOperationalGoalComplete: false };
  writeFileSync(path.join(outputDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
