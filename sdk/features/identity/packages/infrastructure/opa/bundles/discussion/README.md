# Discussion authorization policy (OPA)

This bundle defines authorization rules for discussion-related actions:

- `create-discussion`
- `create-comment`
- `discussion.comment.like`
- `discussion.comment.unlike`

## Expected input shape

The policy evaluates OPA `input` compatible with `IAuthorityValidationContext` from
`@sdk/kernel/ontology/authority`.

Minimal input:

```json
{
  "identityId": "user-123",
  "timestamp": 1730000000000,
  "actionName": "create-comment"
}
```

Recommended input (ABAC-ready):

```json
{
  "identityId": "user-123",
  "timestamp": 1730000000000,
  "actionName": "discussion.comment.like",
  "resource": {
    "type": "comment",
    "id": "comment-999",
  },
  "subject": {
    "roles": ["discussion:writer"]
  }
}
```

## Data model

The policy expects role/permission facts under `data.authority` (provided by `data.json` in this bundle).

- `data.authority.permissions_by_role[role] -> [actions...]`
- `data.authority.roles_by_identity[identityId] -> [roles...]` (optional if roles are sent in input)

Generated bundles contain no identity assignments. Example identity names have
no implicit privileges; roles must come from trusted application input or an
explicitly provisioned policy-data source. Policy tests can be run with an OPA
1.4.2 binary using `OPA_BINARY=/path/to/opa node --test tools/readiness/opa-policies.test.mjs`
from the repository root. This also validates the merged local-deployment data.

## Query

This module defines:

- `data.wapps.discussion.authz.allow` (boolean)
- `data.wapps.discussion.authz.deny` (set of strings)

When OPA runs as a service, you typically query:

- `POST /v1/data/wapps/discussion/authz/allow`

See OPA REST API docs for details.

