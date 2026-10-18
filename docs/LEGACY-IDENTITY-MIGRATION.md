# Staged legacy Identity migration

The October 18, 2026 inspection found one provider mapping in legacy SQL, one
matching Mongo identity node, one `STUB` account and one empty profile. Their
internal UUID agrees. No matching ownership references were found in the copied
SQL or Mongo content stores. The provider is Firebase; these stores contain no
local password credentials or reliable activation/suspension flags.

The user approved preserving this identity in a restricted state while allowing
new local signups. That policy was applied on October 18, 2026 after the live
source matched the disposable-copy rehearsal. Local Authentication, Identity/Account,
BFF and ingress are active against the new schemas. No Firebase integration or
verified provider rebinding is performed. Other domain services remain stopped;
this is authentication activation, not full-stack readiness.

## Supported import

The Account maintenance command supports **unregistered, nondeleted stubs only**.
It requires an exact mapping/node/account/profile join, bounded timestamps, unique
subjects and no unrecognized profile or lifecycle fields. Populated profiles,
deleted rows, extra collections, missing records and other historical formats
require a separate reviewed migration; they are refused rather than discarded.

The importer writes only to a separate, fully migrated, empty canonical schema.
The normal nonempty `identity_subjects` guard remains unchanged. The source SQL and
Mongo stores are retained, including the exact historical provider mapping and
private account data. The new runtime does not read or authenticate against them.

- `identity_id`, `claim` and the public profile ID retain the old internal UUID.
  The original identity creation time is retained.
- The new canonical identity is explicitly inactive and suspended, with no
  credential binding. This is a restriction imposed by the approved migration
  policy, not an inference about the missing historical lifecycle flags.
- The empty profile remains unregistered. The legacy email is not a verified
  contact address or credential-linking proof and is not copied into an active
  profile. The original record remains in the private source archive.
- Identity creation, its durable lifecycle outbox and an import receipt commit in
  one transaction. The existing lifecycle envelope remains compatible; it is not
  an authentication receipt. No projection or content ownership is rewritten.
- A source fingerprint and reviewed plan hash fence the import. Identical replay
  preserves subsequent lifecycle edits; another plan cannot overwrite the import.
  Migration and import share the database advisory lock.

No active credentials or roles are created for the old identity. Enabling access
requires a separate, verified credential-linking and lifecycle decision. Ordinary
signup with the same email creates a different Wapps identity. Unconfigured or
missing bindings still prevent successful credential export/deletion receipts.
Retained legacy private stores also need an explicit retention/erasure plan before
this account is restored to the full export/erasure workflow.

## Procedure

1. Stop legacy writers and preserve backups. Inspect ownership references using
   both the internal UUID and the old external subject. Prefer disposable copies
   for rehearsal. Standalone Mongo reads cannot create an atomic SQL/Mongo snapshot;
   the collector therefore requires stopped writers or immutable source copies.
2. Collect private source evidence. Set `LEGACY_MYSQL_HOST`, `LEGACY_MYSQL_PORT`,
   `LEGACY_MYSQL_USERNAME`, `LEGACY_MYSQL_PASSWORD`, `LEGACY_MYSQL_DATABASE`,
   `LEGACY_MONGO_URI` and `LEGACY_MONGO_DATABASE`, then run:

   ```sh
   node tools/readiness/legacy-identity-evidence.cjs --output /private/path/evidence.json
   ```

   The SQL transaction is read-only. Each collection is bounded to 1,000 records.
   The new output file has mode 0600; existing files are never overwritten. Keep
   credentials in environment configuration and evidence outside source control.
3. Build Account Management and produce the plan without starting a database
   connection, provider or worker:

   ```sh
   node dist/sdk/features/identity/applications/management/main.js \
     --legacy-plan /private/path/evidence.json /private/path/plan.json
   ```

   Review the restricted-account policy, exact IDs and source record hashes.
   The command reports `approvedHash`, the canonical plan fingerprint. That hash
   confirms the reviewed file contents; it does not verify a credential owner.
   Evidence/plan inputs must be regular, nonsymlink files of at most 1 MiB.
4. Provision a separate canonical schema, for example `identity_canonical`, and
   grant its Account database user access. Keep Authentication's schema/user
   separate. With `MYSQL_*` pointing at the new schema, run the built Account
   `--migrate` command. No legacy rows are moved into that schema beforehand.
5. Apply the exact reviewed plan:

   ```sh
   node dist/sdk/features/identity/applications/management/main.js \
     --legacy-import /private/path/plan.json REVIEWED_PLAN_HASH
   ```

   Verify IDs, inactive/suspended state, absence of credential bindings, the single
   creation event per identity and matching `identity_legacy_imports` receipts.
   Injected outbox failure must leave all three tables unchanged; replay must not
   create duplicates or reset later state.
6. Recollect the stopped source immediately before cutover and compare the plan's
   `sourceHash`. Changed data needs a new review/rehearsal, never a forced import.
   Confirm fresh local registration/sign-in through BFF and denial of the legacy
   unbound identity in the staged stack.
7. Only after the account-policy decision, select the staged database using
   `LOCAL_IDENTITY_DATABASE=identity_canonical` for local Compose. This setting
   changes Account and its migration job together; its default remains `identity`.
   Recreate the matching Account, Authentication, BFF and gateway services and
   verify the session workflow. Other deployment configurations remain separate.

Before accepting new writes, rollback can return to the retained source and its
matching earlier configuration/images. After accepting writes, rollback requires
reconciliation or a matching backup; never overwrite new identities with the
legacy snapshot. The importer has no destructive down migration or force option.

## Evidence

The source inspection and rehearsal evidence are under
`/tmp/wapps-legacy-identity-20261018/`; activation evidence is under
`/tmp/wapps-legacy-activation-20261018/`. Private backups, plans, configuration and
evidence are also retained in the ignored, mode-0700 local directory
`deploy/local/identity-cutover.local/`, outside version control. Do not publish it.
`local-auth.test.cjs` adds a staged-import group to the real local authentication
qualification, covering SQL rollback, concurrent replay, exact identifiers,
restricted access and preservation of subsequent canonical state. Its complete
gateway check also starts without the domain services and verifies that their
unavailable routes fail while BFF authentication works.

The live check passes registration/retry, sign-in, forged-header denial, profile
and session persistence across service restarts, refresh rotation/replay denial
and all-session sign-out. The legacy identity remains restricted and unbound.
One dedicated `example.test` smoke account is retained with its sessions revoked.
The original SQL and Mongo backups were restored into separate databases on the
disposable inspection copies and compared with the exact source records.
The activated canonical and credential schemas were backed up together and restored
on the disposable SQL copy, preserving both identities, the binding and zero active
sessions. The matching Compose migration jobs also replay successfully.
See the A21 checkpoint in `IMPLEMENTATION-PROGRESS.md` for commands, scope and
remaining limits. Full product, browser and release readiness remain unverified.
