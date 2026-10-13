# Library builds

- Build Angular components, directives and pipes with the Angular compiler.
  Independently built Angular features use `@nx/angular:package` with explicit
  `ng-package.json`, entrypoint and partial compilation settings.
- Keep pure domain libraries on TypeScript composite builds with explicit
  references. References must point to current SDK/library locations.
- Give each composite library a unique `tsBuildInfoFile` inside its own `outDir`.
  Nx outputs must include both emitted files and incremental metadata. Sibling
  projects must not share the default parent-directory build-info file.
- Build prerequisite libraries before consumers. Executor-specific Nx defaults
  must retain `dependsOn: ["^build"]`; they do not merge the generic build target's
  defaults automatically.
- Match private workspace package identities to their public import aliases so
  Nx resolves built dependencies. Prefer the canonical `@sdk/kernel/standard`
  entrypoint for changed code. Private workspace manifests do not establish a
  registry publication contract.
- Keep compiler roots within the library. Do not compile the whole workspace as
  a dependency workaround or replace a failing build with a no-emit check.
- Verify repaired dependency chains with their declared outputs cleared and Nx
  cache disabled. Preserve unrelated generated outputs and existing user files.
  Portal builds and library builds are separate checks; both must pass.
- Inspect emitted Angular packages as well as the build exit status. Their FESM
  bundles must be ES modules, include partial Angular declarations and resolve
  their relative chunks; public declaration entrypoints must exist. An inherited
  CommonJS setting can produce an unusable `.mjs` file despite a successful build.
  After the aggregator dependency build, run
  `node tools/readiness/check-angular-packages.mjs --project aggregator-angular`.
  Use `--all` after the complete workspace build to inspect every Angular package.
