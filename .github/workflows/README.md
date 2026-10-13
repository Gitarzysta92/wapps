# Workspace quality and release workflows

Every pull request runs `workspace-quality.workflow.yml` without path filters.
Pushes to `main` and `develop` and manual calls also run it. All 15 existing
application image-build jobs depend on this reusable workflow. A failed or
skipped quality job prevents the dependent build from publishing an image.
The aggregator also has an explicit PR trigger; its publishing job runs only
for push or manual dispatch.

## Engineering gate

The workflow checks out the caller revision, uses the Node version in `.nvmrc`,
and runs `npm ci`. It requires the architecture/inventory audit, product lint,
all inventoried project and portable test suites, every declared build, Angular
package artifact inspection, and every declared source/test typecheck target.
Per-project test/lint reports are uploaded even when a check fails.

The workflow currently checks the whole workspace, including for individual
service releases. This costs more than affected-project selection but covers
shared SDK, feature, tooling and configuration changes consistently. A future
optimization must preserve these dependencies and failure behavior.

The shared `test-and-lint` composite action uses the same inventory, architecture,
lint and test entrypoints. It no longer accepts empty tests or uploads a nonexistent
coverage file. See `tools/readiness/README.md` for local commands and coverage gaps.

Repository branch-protection settings must require the Workspace Quality check
to prevent merging a failed PR. Those remote settings were not changed here.
No GitHub workflow run or deployment is certified by local workflow tests.

## Deployment limits

Existing application workflows retain their environment inputs, registry and
cluster configuration. They still contain mutable image tags, source environment
patching, mixed runtime images and unpinned CLI downloads. These are open OP03/OP10
release blockers. A green engineering gate does not qualify this deployment path.

The shared ArgoCD action now propagates sync failures, including after creating
an Application, and requires successful sync and health waiting. Failed commands
must never be followed by an unconditional success report.

Maintainer and Producer remain manually invoked placeholder workflows for
unimplemented projects. Their quality dependency does not create those services;
their missing application builds cannot complete successfully.

## Release evidence

`tools/readiness/ci-gates.test.mjs` checks the workflow dependency gates, unfiltered
PR coverage and aggregator publishing condition, and executes the ArgoCD sync/wait
shell steps with failing local command substitutes. These tests make no cluster
changes. They supplement review and do not replace a real GitHub Actions run.

Full operational scope, deployment acceptance, migration/recovery and rollback
criteria are in `docs/OPERATIONAL-READINESS.md`. Implementation evidence is in
`docs/readiness/implementation-2026-10-11.json`. No workflow configuration change
in this branch has been pushed or deployed.
