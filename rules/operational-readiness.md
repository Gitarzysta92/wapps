# Operational readiness

Use the release definition, acceptance criteria, and ordered backlog in
`docs/OPERATIONAL-READINESS.md` for operational development.

- Complete work in vertical slices: domain/port, application use case, durable
  adapter, API, portal composition, and acceptance test. Keep each change reviewable.
- Production features must use explicitly configured real providers. Demo data
  and browser-local adapters require an explicit demo mode; missing configuration
  or an unavailable backend must not silently select them.
- Treat a feature as complete only when its advertised behavior works against the
  real service contract, persists across restarts and independent sessions, respects
  authorization, and presents failure/empty/loading states truthfully.
- Do not call skipped checks, empty test targets, fixture-only tests, static health
  responses, or a successful frontend build proof of end-to-end readiness.
- Record the commit, commands, outcomes, and relevant environment for release
  checks. Keep unavailable checks marked unverified. Re-run checks affected by a fix.
- Keep migrations, service readiness, event recovery, backup restoration, and
  rollback part of the engineering definition of done.
- Preserve the separate portal theming, width, and spacing rules. Validate changed
  visual behavior at desktop, tablet, and mobile widths in both themes.

Optional features can be deferred only by recording the scope decision and hiding
their unavailable actions in the release. A reduced release is not completion of
the full product described in the operational assessment.
