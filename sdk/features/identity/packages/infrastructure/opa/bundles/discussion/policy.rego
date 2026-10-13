# GENERATED FILE. DO NOT EDIT MANUALLY.
# Source: sdk/features/identity/packages/infrastructure/opa/src/discussion.policy.ts
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
  action in {"discussion.explore.read", "discussion.favorite-updates.read", "discussion.notifications.manage", "discussion.mentions.manage", "discussion.account-erasure.request", "discussion.account-export.read", "discussion.profile.totals.read", "discussion.profile.activity.read", "discussion.profile.participation.read", "review.read", "review.publish", "review.withdraw", "review.helpful", "review.report", "review.moderate", "discussion.application-topic.pin", "discussion.my-topics.read", "discussion.application-topic.vote", "discussion.application-topic.create", "discussion.application-topic.reply", "discussion.application-topic.update", "discussion.application-topic.delete", "discussion.article-comment.create", "discussion.article-comment.reply", "discussion.article-comment.update", "discussion.article-comment.delete", "discussion.comment.like", "discussion.comment.unlike"}
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
    "discussion.explore.read",
    "discussion.notifications.manage",
    "discussion.mentions.manage",
    "discussion.favorite-updates.read",
    "discussion.account-export.read",
    "discussion.account-erasure.request",
    "discussion.profile.participation.read",
    "discussion.profile.activity.read",
    "discussion.profile.totals.read",
    "review.moderate",
    "review.read",
    "review.publish",
    "review.withdraw",
    "review.helpful",
    "review.report",
    "discussion.application-topic.pin",
    "discussion.my-topics.read",
    "discussion.article-comment.create",
    "discussion.article-comment.reply",
    "discussion.article-comment.update",
    "discussion.article-comment.delete",
    "discussion.application-topic.vote",
    "discussion.application-topic.create",
    "discussion.application-topic.reply",
    "discussion.application-topic.update",
    "discussion.application-topic.delete",
    "create-discussion",
    "create-comment",
    "discussion.update",
    "discussion.delete",
    "discussion.comment.like",
    "discussion.comment.unlike",
  }
}

### Role/permission checks

action_permitted(action) if {
  action in {"review.read", "review.publish", "review.withdraw", "review.helpful", "review.report", "discussion.my-topics.read", "discussion.article-comment.create", "discussion.article-comment.reply", "discussion.article-comment.update", "discussion.article-comment.delete", "discussion.application-topic.vote", "discussion.application-topic.create", "discussion.application-topic.reply", "discussion.application-topic.update", "discussion.application-topic.delete"}
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
  not action in {"discussion.explore.read", "discussion.favorite-updates.read", "discussion.notifications.manage", "discussion.mentions.manage", "discussion.account-erasure.request", "discussion.account-export.read", "discussion.profile.totals.read", "discussion.profile.activity.read", "discussion.profile.participation.read", "review.read", "review.publish", "review.withdraw", "review.helpful", "review.report", "review.moderate", "discussion.application-topic.pin", "discussion.my-topics.read", "discussion.application-topic.vote", "discussion.application-topic.create", "discussion.application-topic.reply", "discussion.application-topic.update", "discussion.application-topic.delete", "discussion.article-comment.create", "discussion.article-comment.reply", "discussion.article-comment.update", "discussion.article-comment.delete", "discussion.comment.like", "discussion.comment.unlike"}
}

resource_constraints_ok("discussion.explore.read") if {
  input.resource.type == "explore"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == "discussion"
  input.identityId == "wapps-explore-reader"
  input.tenantId == "explore"
  input.subject.roles == ["explore:reader"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.favorite-updates.read") if {
  input.resource.type == "favorite-updates"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == "discussion"
  input.identityId == "wapps-notification-worker"
  input.tenantId == "notifications"
  input.subject.roles == ["notification:worker"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.notifications.manage") if {
  input.resource.type == "reply-notifications"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == "discussion"
  input.identityId == "wapps-notification-worker"
  input.tenantId == "notifications"
  input.subject.roles == ["notification:worker"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.mentions.manage") if {
  input.resource.type == "mention-notifications"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == "discussion"
  input.identityId == "wapps-notification-worker"
  input.tenantId == "notifications"
  input.subject.roles == ["notification:worker"]
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.account-erasure.request") if {
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

resource_constraints_ok("discussion.account-export.read") if {
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

resource_constraints_ok("discussion.profile.totals.read") if {
  input.resource.type == "profile-totals"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.profile.activity.read") if {
  input.resource.type == "profile-activity"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.profile.participation.read") if {
  input.resource.type == "profile-discussion-collection"
  is_string(input.resource.id)
  input.resource.id != ""
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("review.read") if {
  input.resource.type == "application-review-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("review.publish") if {
  input.resource.type == "application-review-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("review.withdraw") if {
  input.resource.type == "application-review-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("review.helpful") if {
  input.resource.type == "application-review-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("review.report") if {
  input.resource.type == "application-review-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("review.moderate") if {
  input.resource.type == "application-review-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.application-topic.pin") if {
  input.resource.type == "application-topic-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.my-topics.read") if {
  input.resource.type == "my-discussion-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.application-topic.vote") if {
  input.resource.type == "application-topic-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.application-topic.create") if {
  input.resource.type == "application-topic-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.application-topic.reply") if {
  input.resource.type == "application-topic-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.application-topic.update") if {
  input.resource.type == "application-topic-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.application-topic.delete") if {
  input.resource.type == "application-topic-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.article-comment.create") if {
  input.resource.type == "article-comment-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.article-comment.reply") if {
  input.resource.type == "article-comment-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.article-comment.update") if {
  input.resource.type == "article-comment-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.article-comment.delete") if {
  input.resource.type == "article-comment-workspace"
  is_string(input.resource.id)
  input.resource.id != ""
  input.resource.id == input.identityId
  is_string(input.resource.tenantId)
  input.resource.tenantId != ""
  input.resource.tenantId == input.tenantId
}

resource_constraints_ok("discussion.comment.like") if {
  input.resource.type == "comment"
  is_string(input.resource.id)
  input.resource.id != ""
}

resource_constraints_ok("discussion.comment.unlike") if {
  input.resource.type == "comment"
  is_string(input.resource.id)
  input.resource.id != ""
}

