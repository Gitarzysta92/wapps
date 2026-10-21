package wapps.editorial.authz_test

import data.wapps.editorial.authz.allow

health_manager := {"identityId": "Staff", "tenantId": "default", "actionName": "editorial.health.configure", "subject": {"roles": ["editorial:health-manager"]}, "resource": {"type": "application-health", "id": "application", "tenantId": "default"}}
test_health_configuration_requires_staff_and_application_scope if {
  allow with input as health_manager
  allow with input as health_manager with input.subject.roles as ["admin"]
  not allow with input as health_manager with input.subject.roles as []
  not allow with input as health_manager with input.subject.roles as ["editorial:publisher"]
  not allow with input as health_manager with input.resource.tenantId as "private"
  not allow with input as health_manager with input.resource.type as "app"
  not allow with input as health_manager with input.resource.id as ""
}
health_worker := {"identityId": "wapps-health-monitor", "tenantId": "health", "actionName": "editorial.health.probe", "subject": {"roles": ["health:monitor"]}, "resource": {"type": "health-worker", "id": "editorial", "tenantId": "health"}}
test_health_probe_requires_exact_worker_scope if {
  allow with input as health_worker
  not allow with input as health_worker with input.identityId as "Staff"
  not allow with input as health_worker with input.subject.roles as ["admin"]
  not allow with input as health_worker with input.subject.roles as ["health:monitor", "admin"]
  not allow with input as health_worker with input.tenantId as "default"
  not allow with input as health_worker with input.resource.tenantId as "default"
  not allow with input as health_worker with input.resource.type as "application-health"
  not allow with input as health_worker with input.resource.id as "other"
}

profile_reader := {"identityId": "wapps-profile-reader", "tenantId": "default", "actionName": "editorial.profile.suites.read", "subject": {"roles": ["editorial:profile-reader"]}, "resource": {"type": "profile-suite-collection", "id": "OwnerUid", "tenantId": "default"}}
test_profile_reader_scoped_collection if { allow with input as profile_reader }
test_profile_activity_scope_and_role if {
  request := object.union(profile_reader, {"actionName": "editorial.profile.activity.read", "resource": {"type": "profile-activity", "id": "OwnerUid", "tenantId": "default"}})
  allow with input as request
  not allow with input as request with input.resource.tenantId as "private"
  not allow with input as request with input.subject.roles as ["editorial:publisher"]
  not allow with input as request with input.resource.type as "profile-suite-collection"
}
test_profile_reader_cannot_change_tenant if { not allow with input as profile_reader with input.resource.tenantId as "private" }
test_profile_reader_requires_owner_resource if { not allow with input as profile_reader with input.resource.id as "" }
test_publisher_cannot_read_profile_collection if { not allow with input as profile_reader with input.subject.roles as ["editorial:publisher"] }
test_profile_reader_cannot_publish if { not allow with input as profile_reader with input.actionName as "editorial.app.create" with input.resource as {"type": "app", "tenantId": "default"} }

release_owner := {
  "identityId": "Owner", "tenantId": "default", "subject": {"roles": []},
  "resource": {"type": "release-workspace", "id": "Owner", "tenantId": "default"},
}

test_release_workspace_self_actions if {
  every action in ["read", "create", "open", "update", "rebase", "delete", "submit", "withdraw"] {
    allow with input as release_owner with input.actionName as sprintf("editorial.release.%s", [action])
    not allow with input as release_owner with input.actionName as sprintf("editorial.release.%s", [action]) with input.resource.id as "Other"
    not allow with input as release_owner with input.actionName as sprintf("editorial.release.%s", [action]) with input.resource.tenantId as "other"
  }
}

test_release_review_is_separate_from_ownership_and_publishing if {
  review := {"identityId": "Staff", "tenantId": "default", "actionName": "editorial.release.review",
    "subject": {"roles": ["editorial:reviewer"]}, "resource": {"type": "release-review", "id": "draft", "tenantId": "default"}}
  allow with input as review
  not allow with input as review with input.subject.roles as []
  not allow with input as review with input.subject.roles as ["editorial:ownership-reviewer"]
  not allow with input as review with input.subject.roles as ["editorial:publisher"]
  not allow with input as review with input.resource.tenantId as "other"
  not allow with input as review with input.resource.type as "release-workspace"
}

publisher := {
	"identityId": "owner", "tenantId": "default", "actionName": "editorial.app.create",
	"subject": {"roles": ["editorial:publisher"]},
	"resource": {"type": "app", "tenantId": "default"},
}

test_publisher_can_create if allow with input as publisher

test_unassigned_identity_cannot_create if {
	not allow with input as object.union(publisher, {"subject": {"roles": []}})
}

test_taxonomy_role_cannot_publish_apps if {
	not allow with input as object.union(publisher, {"subject": {"roles": ["editorial:taxonomy"]}})
}

test_moderator_cannot_create if {
	not allow with input as object.union(publisher, {"subject": {"roles": ["editorial:moderator"]}})
}

test_moderator_can_delete_in_tenant if {
	allow with input as object.union(publisher, {
		"actionName": "editorial.app.delete", "subject": {"roles": ["editorial:moderator"]},
		"resource": {"type": "app", "id": "record", "tenantId": "default"},
	})
}

test_taxonomy_role_can_create_categories if {
	allow with input as object.union(publisher, {
		"actionName": "editorial.category.create", "subject": {"roles": ["editorial:taxonomy"]},
		"resource": {"type": "category", "tenantId": "default"},
	})
}

test_administrator_still_requires_matching_tenant if {
	not allow with input as object.union(publisher, {"subject": {"roles": ["admin"]}, "resource": {"type": "app", "tenantId": "another"}})
}

test_missing_tenant_denied if {
	not allow with input as publisher with input.resource as {"type": "app"}
}

test_unknown_action_denied if {
	not allow with input as object.union(publisher, {"actionName": "editorial.app.take-ownership"})
}

test_null_identity_denied if {
	not allow with input as object.union(publisher, {"identityId": null})
}

test_object_shaped_roles_denied if {
	not allow with input as object.union(publisher, {"subject": {"roles": {"role": "admin"}}})
}

test_missing_update_id_denied if {
	not allow with input as object.union(publisher, {"actionName": "editorial.app.update"})
}

test_null_update_id_denied if {
	not allow with input as object.union(publisher, {"actionName": "editorial.app.update", "resource": {"type": "app", "id": null, "tenantId": "default"}})
}

suite_owner := {
  "identityId": "Alice", "tenantId": "default", "actionName": "editorial.suite.create",
  "subject": {"roles": []},
  "resource": {"type": "suite-workspace", "id": "Alice", "tenantId": "default"},
}

test_suite_owner_can_manage_private_workspace if {
  every action in ["read", "create", "update", "delete", "submit", "withdraw"] {
    allow with input as suite_owner with input.actionName as sprintf("editorial.suite.%s", [action])
  }
}

test_suite_admin_cannot_use_another_workspace if {
  not allow with input as suite_owner with input.subject.roles as ["admin"] with input.resource.id as "Bob"
}

test_suite_tenant_must_match if {
  not allow with input as suite_owner with input.resource.tenantId as "other"
}

test_suite_missing_identity_denied if {
  not allow with input as suite_owner with input.identityId as ""
}

test_suite_identity_is_case_sensitive if {
  not allow with input as suite_owner with input.resource.id as "alice"
}

suite_reviewer := {
  "identityId": "Reviewer", "tenantId": "default", "actionName": "editorial.suite.review",
  "subject": {"roles": ["editorial:reviewer"]},
  "resource": {"type": "suite-review", "id": "suite", "tenantId": "default"},
}

test_assigned_suite_reviewer_allowed if allow with input as suite_reviewer

test_suite_owner_not_implicitly_a_reviewer if {
  not allow with input as suite_reviewer with input.subject.roles as []
}

test_app_publisher_not_implicitly_a_suite_reviewer if {
  not allow with input as suite_reviewer with input.subject.roles as ["editorial:publisher"]
}

test_suite_reviewer_cannot_cross_tenants if {
  not allow with input as suite_reviewer with input.resource.tenantId as "other"
}

draft_owner := {
  "identityId": "Alice", "tenantId": "default", "actionName": "editorial.application-draft.create",
  "subject": {"roles": []},
  "resource": {"type": "application-workspace", "id": "Alice", "tenantId": "default"},
}

image_owner := {
  "identityId": "Alice", "tenantId": "default", "actionName": "editorial.application-image.create",
  "subject": {"roles": []},
  "resource": {"type": "application-image-workspace", "id": "Alice", "tenantId": "default"},
}

test_image_owner_can_manage_private_uploads if {
  every action in ["read", "create", "upload", "cancel"] {
    allow with input as image_owner with input.actionName as sprintf("editorial.application-image.%s", [action])
  }
}

test_image_admin_cannot_access_another_workspace if {
  not allow with input as image_owner with input.subject.roles as ["admin"] with input.resource.id as "Bob"
}

test_image_tenant_must_match if {
  not allow with input as image_owner with input.resource.tenantId as "other"
}

test_image_anonymous_denied if {
  not allow with input as image_owner with input.identityId as ""
}

test_image_identity_is_case_sensitive if {
  not allow with input as image_owner with input.resource.id as "alice"
}

test_image_wrong_resource_denied if {
  not allow with input as image_owner with input.resource.type as "app"
}

test_image_cancel_never_bypasses_private_scope if {
  not allow with input as image_owner with input.actionName as "editorial.application-image.cancel" with input.subject.roles as ["admin"] with input.resource.id as "Bob"
  not allow with input as image_owner with input.actionName as "editorial.application-image.cancel" with input.resource.tenantId as "other"
  not allow with input as image_owner with input.actionName as "editorial.application-image.cancel" with input.identityId as ""
  not allow with input as image_owner with input.actionName as "editorial.application-image.cancel" with input.resource.type as "app"
}

test_application_draft_owner_can_manage_workspace if {
  every action in ["read", "create", "update", "delete"] {
    allow with input as draft_owner with input.actionName as sprintf("editorial.application-draft.%s", [action])
  }
}

test_application_draft_admin_cannot_access_another_workspace if {
  not allow with input as draft_owner with input.subject.roles as ["admin"] with input.resource.id as "Bob"
}

test_application_draft_tenant_must_match if {
  not allow with input as draft_owner with input.resource.tenantId as "other"
}

test_application_draft_anonymous_denied if {
  not allow with input as draft_owner with input.identityId as ""
}

test_application_draft_identity_is_case_sensitive if {
  not allow with input as draft_owner with input.resource.id as "alice"
}

application_owner := {
  "identityId": "Alice", "tenantId": "default", "actionName": "editorial.application.submit",
  "subject": {"roles": []},
  "resource": {"type": "application-workspace", "id": "Alice", "tenantId": "default"},
}

test_application_owner_can_read_submit_withdraw if {
  every action in ["read", "submit", "withdraw"] {
    allow with input as application_owner with input.actionName as sprintf("editorial.application.%s", [action])
  }
}

test_application_publication_wrong_owner_or_tenant_denied if {
  not allow with input as application_owner with input.resource.id as "Bob"
  not allow with input as application_owner with input.resource.tenantId as "other"
}

application_reviewer := {
  "identityId": "Reviewer", "tenantId": "default", "actionName": "editorial.application.review",
  "subject": {"roles": ["editorial:reviewer"]},
  "resource": {"type": "application-review", "id": "application", "tenantId": "default"},
}

test_application_reviewer_allowed if allow with input as application_reviewer

test_application_owner_or_publisher_is_not_a_reviewer if {
  not allow with input as application_reviewer with input.subject.roles as []
  not allow with input as application_reviewer with input.subject.roles as ["editorial:publisher"]
}

test_application_review_requires_the_same_tenant if {
  not allow with input as application_reviewer with input.resource.tenantId as "other"
}

ownership_claimant := {
  "identityId": "Claimant", "tenantId": "default", "actionName": "editorial.ownership.create",
  "subject": {"roles": []},
  "resource": {"type": "ownership-workspace", "id": "Claimant", "tenantId": "default"},
}

test_claimant_can_manage_only_own_ownership_workspace if {
  every action in ["read", "create", "verify", "cancel", "release"] {
    allow with input as ownership_claimant with input.actionName as sprintf("editorial.ownership.%s", [action])
  }
  not allow with input as ownership_claimant with input.resource.id as "Other"
  not allow with input as ownership_claimant with input.resource.id as "claimant"
  not allow with input as ownership_claimant with input.resource.tenantId as "other"
}

ownership_reviewer := {
  "identityId": "Reviewer", "tenantId": "default", "actionName": "editorial.ownership.review",
  "subject": {"roles": ["editorial:ownership-reviewer"]},
  "resource": {"type": "ownership-review", "id": "claim", "tenantId": "default"},
}

test_ownership_has_dedicated_reviewer_authority if {
  allow with input as ownership_reviewer
  allow with input as ownership_reviewer with input.actionName as "editorial.ownership.revoke"
  not allow with input as ownership_reviewer with input.subject.roles as ["editorial:reviewer"]
  not allow with input as ownership_reviewer with input.subject.roles as ["editorial:publisher"]
  not allow with input as ownership_reviewer with input.subject.roles as []
}

test_ownership_review_cannot_cross_tenants if {
  not allow with input as ownership_reviewer with input.resource.tenantId as "other"
}

test_ownership_review_requires_target_and_actor if {
  not allow with input as ownership_reviewer with input.resource.id as ""
  not allow with input as ownership_reviewer with input.identityId as ""
}

test_ownership_administrator_cannot_use_another_private_workspace if {
  not allow with input as ownership_claimant with input.subject.roles as ["admin"] with input.resource.id as "Other"
}

article_cover_owner := {
  "identityId": "Alice", "tenantId": "default", "actionName": "editorial.article-cover.create",
  "subject": {"roles": []},
  "resource": {"type": "article-cover-workspace", "id": "Alice", "tenantId": "default"},
}

test_article_cover_operations_require_the_owners_workspace if {
  every action in ["read", "create", "upload", "cancel"] {
    allow with input as article_cover_owner with input.actionName as sprintf("editorial.article-cover.%s", [action])
  }
  not allow with input as article_cover_owner with input.resource.id as "Other"
  not allow with input as article_cover_owner with input.resource.id as "alice"
  not allow with input as article_cover_owner with input.resource.tenantId as "other"
  not allow with input as article_cover_owner with input.identityId as ""
}

test_article_cover_policy_rejects_application_resources_even_for_admin if {
  not allow with input as article_cover_owner with input.resource.type as "application-image-workspace"
  not allow with input as article_cover_owner with input.subject.roles as ["admin"] with input.resource.id as "Other"
}

test_profile_totals_scope_and_role if {
  request := object.union(profile_reader, {"actionName": "editorial.profile.totals.read", "resource": {"type": "profile-totals", "id": "OwnerUid", "tenantId": "default"}})
  allow with input as request
  not allow with input as object.union(request, {"subject": {"roles": []}})
  not allow with input as object.union(request, {"tenantId": "other"})
  not allow with input as object.union(request, {"resource": {"type": "profile-totals", "id": "OwnerUid", "tenantId": "other"}})
}

test_profile_article_collection_reader if {
  request := object.union(profile_reader, {"actionName": "editorial.profile.articles.read", "resource": {"type": "profile-article-collection", "id": "OwnerUid", "tenantId": "default"}})
  allow with input as request
  not allow with input as request with input.subject.roles as []
  not allow with input as request with input.resource.tenantId as "private"
  not allow with input as request with input.resource.type as "profile-suite-collection"
  not allow with input as request with input.resource.id as ""
}

export_reader := {
  "identityId": "wapps-account-export-reader", "tenantId": "account-export",
  "actionName": "editorial.account-export.read", "subject": {"roles": ["account-export:reader"]},
  "resource": {"type": "account-export", "id": "Member", "tenantId": "account-export"},
}

test_account_export_fixed_service_allowed if allow with input as export_reader
test_account_export_member_denied if { not allow with input as export_reader with input.identityId as "Member" }
test_account_export_admin_denied if { not allow with input as export_reader with input.subject.roles as ["admin"] }
test_account_export_mixed_roles_denied if { not allow with input as export_reader with input.subject.roles as ["account-export:reader", "admin"] }
test_account_export_foreign_scope_denied if { not allow with input as export_reader with input.tenantId as "other" with input.resource.tenantId as "other" }
test_account_export_foreign_resource_denied if { not allow with input as export_reader with input.resource.type as "discussion" }
test_account_export_empty_owner_denied if { not allow with input as export_reader with input.resource.id as "" }
test_account_export_reader_cannot_write if { not allow with input as export_reader with input.actionName as "editorial.app.create" }

erasure_writer := {
  "identityId": "wapps-account-erasure-writer", "tenantId": "account-erasure",
  "actionName": "editorial.account-erasure.request", "subject": {"roles": ["account-erasure:writer"]},
  "resource": {"type": "account-erasure", "id": "Member", "tenantId": "account-erasure"},
}

test_account_erasure_fixed_service_allowed if allow with input as erasure_writer
test_account_erasure_member_denied if { not allow with input as erasure_writer with input.identityId as "Member" }
test_account_erasure_admin_denied if { not allow with input as erasure_writer with input.subject.roles as ["admin"] }
test_account_erasure_mixed_roles_denied if { not allow with input as erasure_writer with input.subject.roles as ["account-erasure:writer", "admin"] }
test_account_erasure_foreign_scope_denied if { not allow with input as erasure_writer with input.tenantId as "other" with input.resource.tenantId as "other" }
test_account_erasure_foreign_resource_denied if { not allow with input as erasure_writer with input.resource.type as "discussion" }
test_account_erasure_empty_owner_denied if { not allow with input as erasure_writer with input.resource.id as "" }
test_account_erasure_writer_cannot_write if { not allow with input as erasure_writer with input.actionName as "editorial.app.create" }

favorite_update_worker := {"identityId": "wapps-notification-worker", "tenantId": "notifications", "subject": {"roles": ["notification:worker"]}, "actionName": "editorial.favorite-updates.read", "resource": {"type": "favorite-updates", "id": "editorial", "tenantId": "notifications"}}
test_favorite_update_service_exact_scope if {
  allow with input as favorite_update_worker
  not allow with input as favorite_update_worker with input.identityId as "Member"
  not allow with input as favorite_update_worker with input.subject.roles as ["admin"]
  not allow with input as favorite_update_worker with input.tenantId as "default"
  not allow with input as favorite_update_worker with input.resource.tenantId as "default"
  not allow with input as favorite_update_worker with input.resource.type as "account-export"
  not allow with input as favorite_update_worker with input.resource.id as "other"
}

explore_reader := {"identityId": "wapps-explore-reader", "tenantId": "explore", "subject": {"roles": ["explore:reader"]}, "actionName": "editorial.explore.read", "resource": {"type": "explore", "id": "editorial", "tenantId": "explore"}}
test_explore_service_exact_scope if {
  allow with input as explore_reader
  not allow with input as explore_reader with input.identityId as "Member"
  not allow with input as explore_reader with input.subject.roles as ["admin"]
  not allow with input as explore_reader with input.subject.roles as ["explore:reader", "admin"]
  not allow with input as explore_reader with input.tenantId as "default"
  not allow with input as explore_reader with input.resource.tenantId as "default"
  not allow with input as explore_reader with input.resource.type as "profile-activity"
  not allow with input as explore_reader with input.resource.id as "other"
}
