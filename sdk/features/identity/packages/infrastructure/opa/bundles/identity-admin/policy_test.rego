package wapps.identity_admin.authz_test

import data.wapps.identity_admin.authz.allow

mention_resolver := {
	"identityId": "wapps-notification-worker", "tenantId": "notifications",
	"actionName": "identity.mention-recipients.read",
	"subject": {"roles": ["notification:worker"]},
	"resource": {"type": "mention-recipients", "id": "account", "tenantId": "notifications"},
}

test_mention_resolver_service_allowed if allow with input as mention_resolver
test_mention_resolver_admin_denied if {
	not allow with input as mention_resolver with input.identityId as "Admin" with input.subject.roles as ["admin"]
}

test_mention_resolver_other_service_denied if {
	not allow with input as mention_resolver with input.identityId as "other-worker"
}

test_mention_resolver_wrong_scope_denied if {
	not allow with input as mention_resolver with input.tenantId as "default"
}

test_mention_resolver_wrong_resource_denied if {
	not allow with input as mention_resolver with input.resource.type as "user"
}

test_mention_resolver_missing_role_denied if {
	not allow with input as mention_resolver with input.subject.roles as []
}

administrator := {
	"identityId": "operator", "actionName": "identity.user.disable",
	"subject": {"roles": ["identity:admin"]},
	"resource": {"type": "user", "id": "target"},
}

test_identity_admin_can_disable if allow with input as administrator

test_example_identity_has_no_implicit_permissions if {
	not allow with input as {"identityId": "example-admin", "actionName": "identity.user.disable", "resource": {"type": "user", "id": "target"}}
}

test_unassigned_user_denied if {
	not allow with input as administrator with input.subject.roles as []
}

test_null_identity_denied if {
	not allow with input as administrator with input.identityId as null
}

test_object_roles_denied if {
	not allow with input as administrator with input.subject.roles as {"role": "admin"}
}

test_missing_target_denied if {
	not allow with input as administrator with input.resource as {"type": "user"}
}

test_null_target_denied if {
	not allow with input as administrator with input.resource.id as null
}

test_wrong_resource_type_denied if {
	not allow with input as administrator with input.resource.type as "app"
}

test_unsupported_action_denied_even_for_admin if {
	not allow with input as administrator with input.actionName as "unsupported"
		with input.subject.roles as ["admin"]
}

self := {"identityId": "Uid", "actionName": "identity.profile.update", "subject": {"roles": []}, "resource": {"type": "user", "id": "Uid"}}

test_self_account_export if allow with input as self with input.actionName as "identity.account-export.manage"
test_export_cross_account_denied if not allow with input as self with input.actionName as "identity.account-export.manage" with input.resource.id as "Other"
test_export_admin_cross_account_denied if not allow with input as self with input.actionName as "identity.account-export.manage" with input.resource.id as "Other" with input.subject.roles as ["admin"]
test_export_anonymous_denied if not allow with input as self with input.actionName as "identity.account-export.manage" with input.identityId as null
test_export_malformed_roles_denied if not allow with input as self with input.actionName as "identity.account-export.manage" with input.subject.roles as ["admin", 7]

test_self_profile_update if allow with input as self

test_self_profile_read if allow with input as self with input.actionName as "identity.profile.read"

test_profile_other_identity_denied if not allow with input as self with input.resource.id as "Other"

test_admin_cannot_use_self_command_for_other_identity if not allow with input as self with input.subject.roles as ["admin"] with input.resource.id as "Other"

test_self_profile_requires_resource if not allow with input as self with input.resource as {}

test_self_profile_rejects_null_identity if not allow with input as self with input.identityId as null

test_self_profile_rejects_object_roles if not allow with input as self with input.subject.roles as {"admin": true}

test_self_profile_rejects_mixed_roles if not allow with input as self with input.subject.roles as ["admin", 7]

test_self_profile_rejects_array_resource_id if not allow with input as self with input.resource.id as ["Uid"]

test_self_preferences_read if allow with input as self with input.actionName as "identity.preferences.read"

test_self_preferences_update if allow with input as self with input.actionName as "identity.preferences.update"

test_preferences_cross_account_read_denied if not allow with input as self with input.actionName as "identity.preferences.read" with input.resource.id as "Other"

test_preferences_admin_cross_account_write_denied if not allow with input as self with input.actionName as "identity.preferences.update" with input.resource.id as "Other" with input.subject.roles as ["admin"]

test_preferences_anonymous_denied if not allow with input as self with input.actionName as "identity.preferences.update" with input.identityId as null

test_preferences_malformed_roles_denied if not allow with input as self with input.actionName as "identity.preferences.update" with input.subject.roles as ["admin", 7]

test_self_favorites_read if allow with input as self with input.actionName as "identity.favorites.read"

test_self_favorites_update if allow with input as self with input.actionName as "identity.favorites.update"

test_favorites_cross_account_denied if not allow with input as self with input.actionName as "identity.favorites.read" with input.resource.id as "Other"

test_favorites_admin_cross_account_denied if not allow with input as self with input.actionName as "identity.favorites.update" with input.resource.id as "Other" with input.subject.roles as ["admin"]

test_favorites_anonymous_denied if not allow with input as self with input.actionName as "identity.favorites.update" with input.identityId as null

test_favorites_malformed_roles_denied if not allow with input as self with input.actionName as "identity.favorites.update" with input.subject.roles as ["admin", 7]

badge_staff := {"identityId": "StaffUid", "actionName": "identity.profile-badges.update", "subject": {"roles": ["identity:badge-manager"]}, "resource": {"type": "profile-badges", "id": "00000000-0000-4000-8000-000000000001"}}
test_badge_staff_awards_and_revokes if allow with input as badge_staff
test_badge_staff_reads_history if allow with input as badge_staff with input.actionName as "identity.profile-badges.read"
test_badge_global_admin if allow with input as badge_staff with input.subject.roles as ["admin"]
test_badge_owner_cannot_award_itself if not allow with input as badge_staff with input.subject.roles as [] with input.resource.id as "StaffUid"
test_badge_unassigned_admin_denied if not allow with input as badge_staff with input.subject.roles as ["identity:admin"]
test_badge_wrong_resource_denied if not allow with input as badge_staff with input.resource.type as "user"
test_badge_missing_recipient_denied if not allow with input as badge_staff with input.resource.id as null
test_badge_malformed_staff_roles_denied if not allow with input as badge_staff with input.subject.roles as ["identity:badge-manager", 7]
test_badge_staff_cannot_disable_users if not allow with input as badge_staff with input.actionName as "identity.user.disable" with input.resource.type as "user"

test_notification_access_is_self_only if {
	every action in ["identity.notifications.read", "identity.notifications.update"] {
		allow with input as self with input.actionName as action
		not allow with input as self with input.actionName as action with input.resource.id as "Other"
		not allow with input as self with input.actionName as action with input.resource.id as "Other" with input.subject.roles as ["admin"]
		not allow with input as self with input.actionName as action with input.identityId as ""
	}
}
