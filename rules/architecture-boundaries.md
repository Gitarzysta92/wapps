# Architecture boundaries

Follow `architecture-abstract.md`, `docs/FRONTEND-APPLICATION-ARCHITECTURE.md`,
and `sdk/README.md`. The SDK paths are the current backend layout; legacy aliases
do not change a dependency's responsibility.

- Keep domain contracts and business rules independent of Angular, NestJS, ORM
  entities, storage configuration, UI, and portal applications. Put Angular tokens
  in the consuming feature/application layer and infrastructure in adapters.
- Keep `sdk/kernel` independent of product domains, application wiring, and
  concrete adapters. Applications supply dependencies through ports.
- Keep `libs/ui` presentation-focused. Move portal-specific contracts and
  composition into portal boundaries/features instead of importing them into UI.
- Keep shared portal features independent of concrete portals. Pages orchestrate
  application services; feature application services depend on ports. Provider
  functions select concrete adapters.
- Enforce authorization in the application/use-case boundary before domain
  behavior or persistence. A successful policy evaluation with `value: false`
  is a denial. Check resource ownership and tenant scope on every mutation.
- Keep authoritative writes separate from disposable projections. Define failure,
  retry, replay, and consistency behavior when a workflow spans storage and queues.
- Use existing TypeScript strictness, public package exports, DTO validation, and
  the workspace's `Result`/Observable contracts. Do not hide failures with casts,
  fabricated success, or silent fallback to demonstration data.

Assign each Nx project exactly one `arch:*` responsibility matching its location
in `tools/readiness/architecture-policy.mjs`. These tags drive the actual ESLint
dependency matrix. Legacy `type:*` and `scope:*` tags are descriptive, not an
enforcement substitute. Kernel/domain code must also reject concrete framework,
database, credential-provider and broker package imports, including type imports.
Keep transport metadata conversion in the transport adapter.

Run `npm run check:boundaries` and the affected Nx lint, test,
and build targets. The audit fails on existing violations; do not suppress them
or interpret the baseline as an exemption. Fix boundary violations within the
changed slice and record remaining blockers in `docs/OPERATIONAL-READINESS.md`.

The source audit checks six dependency directions, including named adapter
imports through barrels. It does not prove authorization, domain purity inside
methods, all deep-import rules, runtime composition, or visual conventions.
Review these explicitly. Keep graph cycles and unresolved imports covered by
Nx lint and compiler checks.
