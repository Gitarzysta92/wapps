# Frontend source of truth

The user rejected the autonomous frontend changes on October 14, 2026.
The accepted frontend reference is the repository state at
`c965790e063139bcd5e6bacc759f289703e4ea9a`, before the full-operation work.
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb` is a later recovery checkpoint,
not the accepted frontend baseline.

- Focus current development on backend behavior, service contracts and integration.
  Do not continue visual restoration or redesign. The current frontend is not an
  accepted replacement, even where its builds and tests pass.
- Treat the original templates, styles, components, page composition, interactions
  and routes as the presentation source of truth for the eventual merge.
- Derive integration requirements from that original frontend. Implement missing
  backend capabilities through the portal BFF contract, with frontend feature
  ports/providers/mappers consuming that contract. Follow `portal-bff-boundary.md`.
  Do not
  simplify or replace the original UI to match a smaller backend contract.
- Original demo values are not authoritative business data. Ratings, votes,
  counts, authors and badges require real owning-service behavior. Record missing
  support as unfinished integration; do not invent values or silently remove the
  corresponding product behavior.
- Preserve the current implementation before merging the original presentation.
  Keep real authorization, persistence, materialization and API adapters, reconnecting
  them through the original architecture. Do not reset the repository wholesale
  or overwrite unrelated user work.
- Verify backend behavior against the original UI requirements. Passing backend
  checks does not establish frontend fidelity or user acceptance. Keep the eventual
  frontend merge and its visual acceptance as an explicit outstanding step.
