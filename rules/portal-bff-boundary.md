# Portal BFF boundary

The user requires the original frontend to connect through the BFF. This applies
to the full portal integration, including reads, commands, account/authentication
API flows and protected media. The accepted presentation baseline is specified
in `frontend-source-of-truth.md`.

- The request path is frontend feature adapter -> BFF -> owning backend service.
  Ingress may authenticate and route requests to the BFF. A shared browser origin
  whose gateway routes requests directly to domain services does not satisfy this
  boundary. Browser application code must not depend on internal service topology.
- The BFF owns the portal-facing HTTP contract, composes bounded service reads and
  maps responses to the data required by the original frontend. Preserve original
  components and interactions instead of changing them to fit internal service DTOs.
  Dedicated frontend routes map to owning-service capability APIs as specified in
  `capability-api-boundary.md`; moving consumer types out of an SDK is insufficient
  if the owning HTTP API still encodes those consumer types.
- Keep frontend ports/providers/adapters as the integration seam. Their HTTP
  adapters consume BFF endpoints. Cross-service composition belongs behind the
  BFF boundary, not in components or browser adapters.
- Owning services retain domain decisions, resource/tenant authorization,
  authoritative writes, transactions, outboxes and materialization. The BFF does
  not access their databases or replace their authorization with a projection read.
- Validate trusted identity provenance and deliberately forward allowed context.
  Preserve idempotency keys, expected revisions, conflict/error semantics and
  protected-media access. Never forward client-supplied trusted identity headers
  unchecked or expose internal service credentials to the browser.
- Add explicit routes and bounded downstream clients; do not introduce an open
  proxy. Qualify each workflow through the real BFF path, including denial,
  dependency failure and retry. Change ingress routing only when its BFF route
  and required behavior are implemented and verified.

The current implementation is only partially behind the BFF. Direct service
routes are migration work, not approved architectural exceptions. Static frontend
assets and external identity-provider navigation are separate from application
API calls; they do not authorize browser access to internal domain services.
