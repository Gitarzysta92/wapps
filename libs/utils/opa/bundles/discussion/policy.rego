# GENERATED FILE. DO NOT EDIT MANUALLY.
# Source: libs/utils/opa/src/discussion.policy.ts
package wapps.discussion.authz

default allow := false

# Optional deny reasons (useful for debugging and audit logs).
deny contains msg if {
  not has_identity
  msg := "missing_identity"
}

deny contains msg if {
  has_identity
  action := requested_action
  not supported_action(action)
  msg := sprintf("unsupported_action:%s", [action])
}

deny contains msg if {
  has_identity
  action := requested_action
  supported_action(action)
  not action_permitted(action)
  msg := sprintf("forbidden:%s", [action])
}

deny contains msg if {
  has_identity
  action := requested_action
  action in {"discussion.comment.like", "discussion.comment.unlike"}
  not resource_constraints_ok(action)
  msg := sprintf("invalid_resource:%s", [action])
}

allow if {
  has_identity
  action := requested_action
  supported_action(action)
  action_permitted(action)
  resource_constraints_ok(action)
}

### Input helpers

has_identity if {
  input.identityId != ""
}

requested_action := a if { a := input.action } else := a if { a := input.actionName }

supported_action(a) if {
  a in {
    "create-discussion",
    "create-comment",
    "discussion.comment.like",
    "discussion.comment.unlike",
  }
}

### Role/permission checks

action_permitted(action) if {
  "admin" in subject_roles
}

action_permitted(action) if {
  some r in subject_roles
  perms := data.authority.permissions_by_role[r]
  "*" in perms
}

action_permitted(action) if {
  some r in subject_roles
  perms := data.authority.permissions_by_role[r]
  action in perms
}

subject_roles := roles if {
  roles := input.subject.roles
} else := roles if {
  roles := data.authority.roles_by_identity[input.identityId]
} else := []

### Resource constraints
resource_constraints_ok(action) if {
  not action in {"discussion.comment.like", "discussion.comment.unlike"}
}

resource_constraints_ok("discussion.comment.like") if {
  input.resource.type == "comment"
  input.resource.id != ""
}

resource_constraints_ok("discussion.comment.unlike") if {
  input.resource.type == "comment"
  input.resource.id != ""
}

