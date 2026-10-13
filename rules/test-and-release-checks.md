# Test and release checks

- Use the development Node version in `.nvmrc` and the checked-in dependency
  lockfile. Qualify installation in an isolated source snapshot; existing nested
  `node_modules` directories can hide dependency-resolution problems.
- Run `npm test` for the inventoried Jest and portable readiness suites. Every
  project-owned spec needs a working target with `passWithNoTests: false`.
  Skipped/todo tests, empty results and undiscovered spec files fail the gate.
- Projects without behavior specs belong in
  `tools/readiness/test-coverage-gaps.json`, with no misleading empty test target.
  Remove the gap when adding the project's first tests. Consumer tests and builds
  do not make an untested feature complete. Do not remove real coverage to pass.
- Run `npm run lint` for explicit and inferred production-project targets plus
  the readiness tools. The user-owned recordings tooling has a separate runtime
  and is outside this product lint gate. Existing warnings remain visible debt.
- Run all declared builds and typecheck targets. Inspect Angular artifacts after
  builds. Test transpilation does not replace source/test typechecking.
- Keep external OPA, database, broker, object-storage and Firebase-emulator suites
  separately qualified. The portable test gate must identify these unrun suites;
  it must not report skips as successful integration tests.
- Every image-publishing build must depend on the reusable workspace quality
  workflow. Failed, cancelled or skipped checks must prevent publishing/deploying.
  Preserve the unfiltered pull-request gate for shared and root changes.
- Preserve failures from deployment sync and health checks. A command followed by
  `|| true`, an unconditional success report, or a mutable image tag is not release
  qualification. Existing mutable deployment tags remain an open release blocker.

See `tools/readiness/README.md` for commands and the limits of these checks.
