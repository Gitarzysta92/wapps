# GENERATED FILE. DO NOT EDIT MANUALLY.
# Source: libs/utils/opa/src/identity-admin.policy.ts
package wapps.identity_admin.authz

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
  action in {"identity.graph.read", "identity.user.disable", "identity.user.enable", "identity.user.revoke_tokens", "identity.user.delete", "identity.user.update_email", "identity.user.update_password", "identity.user.unlink_provider", "identity.user.generate_password_reset_link", "identity.user.generate_email_verification_link"}
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
    "identity.graph.read",
    "identity.user.disable",
    "identity.user.enable",
    "identity.user.revoke_tokens",
    "identity.user.delete",
    "identity.user.update_email",
    "identity.user.update_password",
    "identity.user.unlink_provider",
    "identity.user.generate_password_reset_link",
    "identity.user.generate_email_verification_link",
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
  not action in {"identity.graph.read", "identity.user.disable", "identity.user.enable", "identity.user.revoke_tokens", "identity.user.delete", "identity.user.update_email", "identity.user.update_password", "identity.user.unlink_provider", "identity.user.generate_password_reset_link", "identity.user.generate_email_verification_link"}
}

resource_constraints_ok("identity.graph.read") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.disable") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.enable") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.revoke_tokens") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.delete") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.update_email") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.update_password") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.unlink_provider") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.generate_password_reset_link") if {
  input.resource.type == "user"
  input.resource.id != ""
}

resource_constraints_ok("identity.user.generate_email_verification_link") if {
  input.resource.type == "user"
  input.resource.id != ""
}

