# Authentication and Identity boundary

The user requires authentication to be a separate, swappable process. Replacing
an in-process adapter alone does not satisfy this requirement.

- Authentication owns credential verification, credential sessions and their
  revocation. Provider implementations and credential persistence remain behind
  its explicit service contract. Local authentication is a development implementation
  of that contract; selecting it never silently falls back from a failed provider.
- Identity owns stable application identity IDs, lifecycle state, and verified
  mappings from provider-qualified subjects to those IDs. A provider subject is
  not the application identity. Preserve existing application IDs when changing
  authentication providers; never infer an account link from matching email alone.
- Authentication does not access canonical Identity/Account tables or own profile
  enrollment, content ownership, application authorization or materialization.
  Identity and Account do not instantiate credential-provider adapters or access
  credential tables. Use authenticated, bounded service contracts in both directions
  where a workflow requires them, with explicit failure and retry semantics.
- Resolve authenticated subjects through Identity before granting application
  access. A valid credential cannot override canonical suspension/deletion or
  owning-service authorization. Do not accept a caller-supplied subject or identity
  as proof of authentication or account linking.
- The BFF preserves the portal contract and maps/composes service results. It does
  not own identity mappings, credentials, lifecycle decisions or their databases.
- Credential administration, revocation, export and deletion cross the same process
  boundary as sign-in. Preserve accepted export/erasure provider plans, receipts,
  outboxes and retry behavior. Missing bindings or unavailable providers cannot
  produce synthetic successful cleanup or export receipts.
- Qualify the boundary using independently running authentication and Identity
  processes with separate persistence access, an alternate authentication
  implementation, exact provider/subject isolation, stable application IDs, denied
  account linking, outages, and existing ownership/materialization preservation.
  Document legacy mapping migrations explicitly; do not delete mappings or bypass
  migration guards to make an installation start.

The source audit enforces the direct process dependency boundary as ARCH011.
Runtime qualification must additionally prove independent database grants and
service response/issuer/subject validation; the import scan cannot prove those.
