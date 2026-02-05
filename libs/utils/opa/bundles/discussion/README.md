# Discussion authorization policy (OPA)

This bundle defines authorization rules for discussion-related actions:

- `create-discussion`
- `create-comment`
- `discussion.comment.like`
- `discussion.comment.unlike`

## Expected input shape

The policy evaluates OPA `input` compatible with `IAuthorityValidationContext` from
`libs/foundation/authority-system`.

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

## Query

This module defines:

- `data.wapps.discussion.authz.allow` (boolean)
- `data.wapps.discussion.authz.deny` (set of strings)

When OPA runs as a service, you typically query:

- `POST /v1/data/wapps/discussion/authz/allow`

See OPA REST API docs for details.

