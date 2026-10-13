# GENERATED FILE. DO NOT EDIT MANUALLY.
# Source: sdk/features/identity/packages/infrastructure/opa/src/editorial.policy.ts
package wapps.editorial.authz

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
  action in {"editorial.health.configure", "editorial.health.probe", "editorial.explore.read", "editorial.favorite-updates.read", "editorial.account-export.read", "editorial.account-erasure.request", "editorial.profile.suites.read", "editorial.profile.articles.read", "editorial.profile.activity.read", "editorial.profile.totals.read", "editorial.app.create", "editorial.app.update", "editorial.app.delete", "editorial.category.create", "editorial.category.update", "editorial.category.delete", "editorial.tag.create", "editorial.tag.update", "editorial.tag.delete", "editorial.suite.read", "editorial.suite.create", "editorial.suite.update", "editorial.suite.delete", "editorial.suite.submit", "editorial.suite.withdraw", "editorial.release.read", "editorial.release.create", "editorial.release.open", "editorial.release.update", "editorial.release.rebase", "editorial.release.delete", "editorial.release.submit", "editorial.release.withdraw", "editorial.article.read", "editorial.article.create", "editorial.article.update", "editorial.article.delete", "editorial.article.submit", "editorial.article.withdraw", "editorial.application-draft.read", "editorial.application-draft.create", "editorial.application-draft.update", "editorial.application-draft.delete", "editorial.application.read", "editorial.application.submit", "editorial.application.withdraw", "editorial.application-image.read", "editorial.application-image.create", "editorial.application-image.upload", "editorial.application-image.cancel", "editorial.article-cover.read", "editorial.article-cover.create", "editorial.article-cover.upload", "editorial.article-cover.cancel", "editorial.ownership.read", "editorial.ownership.create", "editorial.ownership.verify", "editorial.ownership.cancel", "editorial.ownership.release", "editorial.ownership.review", "editorial.ownership.revoke", "editorial.application.review", "editorial.suite.review", "editorial.release.review", "editorial.article.review"}
  not resource_constraints_ok(action)
  msg := sprintf("invalid_resource:%s", [action])
}

allow if {
  has_identity
  is_array(subject_roles)
  every role in subject_roles { is_string(role) }
  action := requested_action
  supported_action(action)
  action_permitted(action)
  resource_constraints_ok(action)
}

### Input helpers

has_identity if {
  is_string(input.identityId)
  input.identityId != ""
}

requested_action := a if { a := input.action } else := a if { a := input.actionName }

supported_action(a) if {
  a in {
    "editorial.health.configure",
    "editorial.health.probe",
    "editorial.explore.read",
    "editorial.favorite-updates.read",
    "editorial.account-export.read",
    "editorial.account-erasure.request",
    "editorial.app.create",
    "editorial.app.update",
    "editorial.app.delete",
    "editorial.category.create",
    "editorial.category.update",
    "editorial.category.delete",
    "editorial.tag.create",
    "editorial.tag.update",
    "editorial.tag.delete",
    "editorial.suite.read",
    "editorial.suite.create",
    "editorial.suite.update",
    "editorial.suite.delete",
    "editorial.suite.submit",
    "editorial.suite.withdraw",
    "editorial.release.read",
    "editorial.release.create",
    "editorial.release.open",
    "editorial.release.update",
    "editorial.release.rebase",
    "editorial.release.delete",
    "editorial.release.submit",
    "editorial.release.withdraw",
    "editorial.article.read",
    "editorial.article.create",
    "editorial.article.update",
    "editorial.article.delete",
    "editorial.article.submit",
    "editorial.article.withdraw",
    "editorial.application-draft.read",
    "editorial.application-draft.create",
    "editorial.application-draft.update",
    "editorial.application-draft.delete",
    "editorial.application.read",
    "editorial.application.submit",
    "editorial.application.withdraw",
    "editorial.application-image.read",
    "editorial.application-image.create",
    "editorial.application-image.upload",
    "editorial.application-image.cancel",
    "editorial.article-cover.read",
    "editorial.article-cover.create",
    "editorial.article-cover.upload",
    "editorial.article-cover.cancel",
    "editorial.ownership.read",
    "editorial.ownership.create",
    "editorial.ownership.verify",
    "editorial.ownership.cancel",
    "editorial.ownership.release",
    "editorial.ownership.review",
    "editorial.ownership.revoke",
    "editorial.application.review",
    "editorial.suite.review",
    "editorial.release.review",
    "editorial.article.review",
    "editorial.profile.suites.read",
    "editorial.profile.articles.read",
    "editorial.profile.activity.read",
    "editorial.profile.totals.read",
  }
}

### Role/permission checks

action_permitted(action) if {
  action in {"editorial.suite.read", "editorial.suite.create", "editorial.suite.update", "editorial.suite.delete", "editorial.suite.submit", "editorial.suite.withdraw", "editorial.release.read", "editorial.release.create", "editorial.release.open", "editorial.release.update", "editorial.release.rebase", "editorial.release.delete", "editorial.release.submit", "editorial.release.withdraw", "editorial.article.read", "editorial.article.create", "editorial.article.update", "editorial.article.delete", "editorial.article.submit", "editorial.article.withdraw", "editorial.application-draft.read", "editorial.application-draft.create", "editorial.application-draft.update", "editorial.application-draft.delete", "editorial.application.read", "editorial.application.submit", "editorial.application.withdraw", "editorial.application-image.read", "editorial.application-image.create", "editorial.application-image.upload", "editorial.application-image.cancel", "editorial.article-cover.read", "editorial.article-cover.create", "editorial.article-cover.upload", "editorial.article-cover.cancel", "editorial.ownership.read", "editorial.ownership.create", "editorial.ownership.verify", "editorial.ownership.cancel", "editorial.ownership.release"}
}

action_permitted(_) if {
  "admin" in subject_roles
}

action_permitted(_) if {
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
  not action in {"editorial.health.configure", "editorial.health.probe", "editorial.explore.read", "editorial.favorite-updates.read", "editorial.account-export.read", "editorial.account-erasure.request", "editorial.profile.suites.read", "editorial.profile.articles.read", "editorial.profile.activity.read", "editorial.profile.totals.read", "editorial.app.create", "editorial.app.update", "editorial.app.delete", "editorial.category.create", "editorial.category.update", "editorial.category.delete", "editorial.tag.create", "editorial.tag.update", "editorial.tag.delete", "editorial.suite.read", "editorial.suite.create", "editorial.suite.update", "editorial.suite.delete", "editorial.suite.submit", "editorial.suite.withdraw", "editorial.release.read", "editorial.release.create", "editorial.release.open", "editorial.release.update", "editorial.release.rebase", "editorial.release.delete", "editorial.release.submit", "editorial.release.withdraw", "editorial.article.read", "editorial.article.create", "editorial.article.update", "editorial.article.delete", "editorial.article.submit", "editorial.article.withdraw", "editorial.application-draft.read", "editorial.application-draft.create", "editorial.application-draft.update", "editorial.application-draft.delete", "editorial.application.read", "editorial.application.submit", "editorial.application.withdraw", "editorial.application-image.read", "editorial.application-image.create", "editorial.application-image.upload", "editorial.application-image.cancel", "editorial.article-cover.read", "editorial.article-cover.create", "editorial.article-cover.upload", "editorial.article-cover.cancel", "editorial.ownership.read", "editorial.ownership.create", "editorial.ownership.verify", "editorial.ownership.cancel", "editorial.ownership.release", "editorial.ownership.review", "editorial.ownership.revoke", "editorial.application.review", "editorial.suite.review", "editorial.release.review", "editorial.article.review"}
}

resource_constraints_ok("editorial.health.configure") if {
  input.resource.type == "application-health"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.health.probe") if {
  input.resource.type == "health-worker"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == "editorial"
  input.identityId == "wapps-health-monitor"
  input.tenantId == "health"
  input.subject.roles == ["health:monitor"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.explore.read") if {
  input.resource.type == "explore"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == "editorial"
  input.identityId == "wapps-explore-reader"
  input.tenantId == "explore"
  input.subject.roles == ["explore:reader"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.favorite-updates.read") if {
  input.resource.type == "favorite-updates"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == "editorial"
  input.identityId == "wapps-notification-worker"
  input.tenantId == "notifications"
  input.subject.roles == ["notification:worker"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.account-export.read") if {
  input.resource.type == "account-export"
  is_string(input.resource.id)
  input.resource.id != ""
  input.identityId == "wapps-account-export-reader"
  input.tenantId == "account-export"
  input.subject.roles == ["account-export:reader"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.account-erasure.request") if {
  input.resource.type == "account-erasure"
  is_string(input.resource.id)
  input.resource.id != ""
  input.identityId == "wapps-account-erasure-writer"
  input.tenantId == "account-erasure"
  input.subject.roles == ["account-erasure:writer"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.profile.suites.read") if {
  input.resource.type == "profile-suite-collection"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.profile.articles.read") if {
  input.resource.type == "profile-article-collection"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.profile.activity.read") if {
  input.resource.type == "profile-activity"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.profile.totals.read") if {
  input.resource.type == "profile-totals"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.app.create") if {
  input.resource.type == "app"
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.app.update") if {
  input.resource.type == "app"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.app.delete") if {
  input.resource.type == "app"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.category.create") if {
  input.resource.type == "category"
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.category.update") if {
  input.resource.type == "category"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.category.delete") if {
  input.resource.type == "category"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.tag.create") if {
  input.resource.type == "tag"
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.tag.update") if {
  input.resource.type == "tag"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.tag.delete") if {
  input.resource.type == "tag"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.suite.read") if {
  input.resource.type == "suite-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.suite.create") if {
  input.resource.type == "suite-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.suite.update") if {
  input.resource.type == "suite-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.suite.delete") if {
  input.resource.type == "suite-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.suite.submit") if {
  input.resource.type == "suite-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.suite.withdraw") if {
  input.resource.type == "suite-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.read") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.create") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.open") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.update") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.rebase") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.delete") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.submit") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.withdraw") if {
  input.resource.type == "release-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article.read") if {
  input.resource.type == "article-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article.create") if {
  input.resource.type == "article-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article.update") if {
  input.resource.type == "article-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article.delete") if {
  input.resource.type == "article-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article.submit") if {
  input.resource.type == "article-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article.withdraw") if {
  input.resource.type == "article-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-draft.read") if {
  input.resource.type == "application-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-draft.create") if {
  input.resource.type == "application-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-draft.update") if {
  input.resource.type == "application-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-draft.delete") if {
  input.resource.type == "application-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application.read") if {
  input.resource.type == "application-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application.submit") if {
  input.resource.type == "application-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application.withdraw") if {
  input.resource.type == "application-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-image.read") if {
  input.resource.type == "application-image-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-image.create") if {
  input.resource.type == "application-image-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-image.upload") if {
  input.resource.type == "application-image-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application-image.cancel") if {
  input.resource.type == "application-image-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article-cover.read") if {
  input.resource.type == "article-cover-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article-cover.create") if {
  input.resource.type == "article-cover-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article-cover.upload") if {
  input.resource.type == "article-cover-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article-cover.cancel") if {
  input.resource.type == "article-cover-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.ownership.read") if {
  input.resource.type == "ownership-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.ownership.create") if {
  input.resource.type == "ownership-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.ownership.verify") if {
  input.resource.type == "ownership-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.ownership.cancel") if {
  input.resource.type == "ownership-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.ownership.release") if {
  input.resource.type == "ownership-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.ownership.review") if {
  input.resource.type == "ownership-review"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.ownership.revoke") if {
  input.resource.type == "ownership-review"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.application.review") if {
  input.resource.type == "application-review"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.suite.review") if {
  input.resource.type == "suite-review"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.release.review") if {
  input.resource.type == "release-review"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("editorial.article.review") if {
  input.resource.type == "article-review"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

