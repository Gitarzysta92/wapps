import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
function readYaml(filename) {
  const document = parseDocument(readFileSync(path.join(root, filename), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(document.errors, [], filename);
  return document.toJS();
}
const workflows = readdirSync(path.join(root, '.github/workflows')).filter((name) => name.endsWith('.yml'));
const reusable = './.github/workflows/workspace-quality.workflow.yml';

test('every release build requires a successful workspace gate', () => {
  for (const name of workflows) {
    const workflow = readYaml(`.github/workflows/${name}`);
    if (!workflow.jobs.build) continue;
    const build = workflow.jobs.build;
    const needs = Array.isArray(build.needs) ? build.needs : [build.needs];
    assert.ok(needs.some((job) => workflow.jobs[job]?.uses === reusable), `${name}: missing quality dependency`);
    assert.doesNotMatch(build.if || '', /(?:always|failure|cancelled)\s*\(/, name);
    assert.notEqual(build['continue-on-error'], true, name);
    for (const job of needs) {
      if (workflow.jobs[job]?.uses !== reusable) continue;
      assert.equal(workflow.jobs[job].if, undefined, `${name}: quality must always run`);
      assert.equal(workflow.jobs[job]['secrets'], undefined, `${name}: quality needs no deployment secrets`);
    }
  }
});

test('the unfiltered PR gate installs locked dependencies and requires all engineering checks', () => {
  const workflow = readYaml('.github/workflows/workspace-quality.workflow.yml');
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  assert.equal(workflow.on.pull_request, null);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_call'));
  const steps = workflow.jobs.checks.steps;
  const commands = steps.map((step) => step.run || '').join('\n');
  for (const expected of ['npm ci', 'npm run check:boundaries', 'npm run check:inventory', 'npm run lint', 'npm test', 'nx run-many -t build --all --skip-nx-cache', 'check-angular-packages.mjs --all', 'nx run-many -t typecheck --all']) assert.ok(commands.includes(expected), expected);
  for (const step of steps.filter((step) => step.run)) {
    assert.equal(step.if, undefined);
    assert.notEqual(step['continue-on-error'], true);
    assert.doesNotMatch(step.run, /\|\|\s*true|passWithNoTests/);
  }
});

test('aggregator PRs cannot push images and shared changes trigger its release gate', () => {
  const workflow = readYaml('.github/workflows/aggregator-csr.workflow.yml');
  assert.ok(workflow.on.pull_request);
  assert.match(workflow.jobs.build.if, /github.event_name == 'push'/);
  assert.match(workflow.jobs.build.if, /github.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(workflow.jobs.build.if, /pull_request/);
  for (const required of ['apps/portals/shared/**', 'sdk/**', 'libs/**', 'package*.json', 'nx.json']) assert.ok(workflow.on.push.paths.includes(required), required);
});

test('ArgoCD failures propagate from both creation sync and health wait', () => {
  const action = readYaml('.github/actions/sync-argocd-app/action.yml');
  const sync = action.runs.steps.find((step) => step.name === 'Create/Sync ArgoCD Application').run;
  const wait = action.runs.steps.find((step) => step.name === 'Wait for sync to complete').run;
  assert.match(wait, /--sync --health/);
  const values = { 'app-name': 'test-app', 'app-manifest-path': 'fixture.yaml', 'force-sync': 'true', 'sync-timeout': '1' };
  const expand = (script) => script.replace(/\$\{\{ inputs\.([^ ]+) \}\}/g, (_, key) => values[key]);
  for (const script of [sync, wait]) {
    const shell = `argocd() { if [ "$2" = get ]; then return 1; fi; return 42; }\nkubectl() { return 0; }\nsleep() { return 0; }\n${expand(script)}`;
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', shell], { encoding: 'utf8' });
    assert.equal(result.status, 42, result.stderr);
    assert.doesNotMatch(result.stdout, /sync completed/);
  }
});
