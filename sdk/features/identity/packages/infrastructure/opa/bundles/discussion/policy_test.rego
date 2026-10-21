package wapps.discussion.authz_test

import data.wapps.discussion.authz.allow

export_reader := {
  "identityId": "wapps-account-export-reader", "tenantId": "account-export",
  "actionName": "discussion.account-export.read", "subject": {"roles": ["account-export:reader"]},
  "resource": {"type": "account-export", "id": "Member", "tenantId": "account-export"},
}

test_account_export_fixed_service_allowed if allow with input as export_reader
test_account_export_member_denied if { not allow with input as export_reader with input.identityId as "Member" }
test_account_export_admin_denied if { not allow with input as export_reader with input.subject.roles as ["admin"] }
test_account_export_mixed_roles_denied if { not allow with input as export_reader with input.subject.roles as ["account-export:reader", "admin"] }
test_account_export_foreign_scope_denied if { not allow with input as export_reader with input.tenantId as "other" with input.resource.tenantId as "other" }
test_account_export_foreign_resource_denied if { not allow with input as export_reader with input.resource.type as "discussion" }
test_account_export_empty_owner_denied if { not allow with input as export_reader with input.resource.id as "" }
test_account_export_reader_cannot_write if { not allow with input as export_reader with input.actionName as "create-discussion" }

writer := {
	"identityId": "owner", "actionName": "create-discussion",
	"subject": {"roles": ["discussion:writer"]},
}

test_writer_can_create if allow with input as writer

my_topics := {
  "identityId": "member", "tenantId": "default",
  "actionName": "discussion.my-topics.read", "subject": {"roles": []},
  "resource": {"type": "my-discussion-workspace", "id": "member", "tenantId": "default"},
}

test_member_can_read_own_topics if allow with input as my_topics

test_my_topics_requires_matching_identity if {
  not allow with input as my_topics with input.resource.id as "other"
}

test_my_topics_requires_matching_tenant if {
  not allow with input as my_topics with input.resource.tenantId as "other"
}

test_my_topics_requires_identity if {
  not allow with input as my_topics with input.identityId as ""
}

test_my_topics_admin_cannot_read_other_account if {
  not allow with input as my_topics with input.resource.id as "other" with input.subject.roles as ["admin"]
}

test_my_topics_requires_correct_workspace if {
  not allow with input as my_topics with input.resource.type as "application-topic-workspace"
}

comment_actor := {
  "identityId": "member", "tenantId": "default",
  "actionName": "discussion.article-comment.create", "subject": {"roles": []},
  "resource": {"type": "article-comment-workspace", "id": "member", "tenantId": "default"},
}

test_authenticated_member_can_comment if allow with input as comment_actor

test_comment_actions_require_matching_actor if {
  not allow with input as comment_actor with input.resource.id as "other"
}

test_comment_actions_require_matching_tenant if {
  not allow with input as comment_actor with input.resource.tenantId as "other"
}

test_comment_actions_require_identity if {
  not allow with input as comment_actor with input.identityId as ""
}

test_comment_admin_cannot_bypass_workspace_scope if {
  not allow with input as comment_actor with input.resource.id as "other"
    with input.subject.roles as ["admin"]
}

topic_actor := {
  "identityId": "member", "tenantId": "default",
  "actionName": "discussion.application-topic.create", "subject": {"roles": []},
  "resource": {"type": "application-topic-workspace", "id": "member", "tenantId": "default"},
}

test_member_can_participate_in_application_topics if {
  every action in ["create", "reply", "update", "delete", "vote"] {
    allow with input as topic_actor with input.actionName as sprintf("discussion.application-topic.%s", [action])
  }
}

test_application_topic_requires_matching_identity if {
  not allow with input as topic_actor with input.resource.id as "other"
}

test_application_topic_requires_matching_tenant if {
  not allow with input as topic_actor with input.resource.tenantId as "other"
}

test_application_topic_requires_identity if {
  not allow with input as topic_actor with input.identityId as ""
}

test_application_topic_admin_cannot_bypass_workspace_scope if {
  not allow with input as topic_actor with input.resource.id as "other"
    with input.subject.roles as ["admin"]
}

test_application_topic_cannot_use_article_workspace if {
  not allow with input as topic_actor with input.resource.type as "article-comment-workspace"
}

test_article_comment_cannot_use_application_workspace if {
  not allow with input as comment_actor with input.resource.type as "application-topic-workspace"
}

test_example_identity_has_no_implicit_permissions if {
	not allow with input as {"identityId": "example-user", "actionName": "create-discussion"}
}

test_reader_cannot_create if {
	not allow with input as writer with input.subject.roles as ["discussion:reader"]
}

test_reader_can_like_comment if {
	allow with input as writer with input.actionName as "discussion.comment.like"
		with input.subject.roles as ["discussion:reader"]
		with input.resource as {"type": "comment", "id": "comment-id"}
}

test_null_identity_denied if {
	not allow with input as writer with input.identityId as null
}

test_object_roles_denied if {
	not allow with input as writer with input.subject.roles as {"role": "admin"}
}

test_missing_comment_id_denied if {
	not allow with input as writer with input.actionName as "discussion.comment.like"
		with input.resource as {"type": "comment"}
}

test_null_comment_id_denied if {
	not allow with input as writer with input.actionName as "discussion.comment.like"
		with input.resource as {"type": "comment", "id": null}
}

test_unsupported_action_denied_even_for_admin if {
	not allow with input as writer with input.actionName as "unsupported"
		with input.subject.roles as ["admin"]
}


test_application_vote_cannot_spoof_identity_or_tenant if {
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.vote" with input.resource.id as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.vote" with input.resource.tenantId as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.vote" with input.identityId as ""
}

test_only_admin_can_pin_application_topics if {
  allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"]
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["discussion:writer"]
}

test_pin_admin_cannot_bypass_tenant_identity_or_workspace if {
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"] with input.resource.tenantId as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"] with input.resource.id as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"] with input.resource.type as "article-comment-workspace"
}

review_actor := {
  "identityId": "Member", "tenantId": "default", "actionName": "review.publish",
  "subject": {"roles": []},
  "resource": {"id": "Member", "tenantId": "default", "type": "application-review-workspace"}
}

test_review_member_actions if {
  every action in ["read", "publish", "withdraw", "helpful", "report"] {
    allow with input as review_actor with input.actionName as sprintf("review.%s", [action])
  }
}

test_review_moderation_requires_staff if {
  not allow with input as review_actor with input.actionName as "review.moderate"
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["discussion:writer"]
  allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"]
}

test_review_identity_and_tenant_cannot_be_spoofed if {
  not allow with input as review_actor with input.resource.id as "Other"
  not allow with input as review_actor with input.resource.tenantId as "other"
  not allow with input as review_actor with input.identityId as ""
}

test_review_admin_cannot_bypass_scope if {
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"] with input.resource.id as "Other"
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"] with input.resource.type as "application-topic-workspace"
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"] with input.resource.tenantId as "other"
}

profile_reader := {"identityId": "wapps-profile-reader", "tenantId": "default", "subject": {"roles": ["discussion:profile-reader"]}, "actionName": "discussion.profile.participation.read", "resource": {"type": "profile-discussion-collection", "id": "OwnerUid", "tenantId": "default"}}
test_profile_reader_allowed if { allow with input as profile_reader }
test_profile_activity_scope_and_role if {
  request := object.union(profile_reader, {"actionName": "discussion.profile.activity.read", "resource": {"type": "profile-activity", "id": "OwnerUid", "tenantId": "default"}})
  allow with input as request
  not allow with input as request with input.resource.tenantId as "private"
  not allow with input as request with input.subject.roles as ["discussion:writer"]
  not allow with input as request with input.resource.type as "profile-discussion-collection"
}
test_profile_reader_role_required if { not allow with input as profile_reader with input.subject.roles as [] }
test_profile_reader_scope_required if { not allow with input as profile_reader with input.resource.tenantId as "other" }
test_profile_reader_resource_required if { not allow with input as profile_reader with input.resource.type as "my-discussion-workspace" }
test_profile_reader_has_no_ordinary_write if { not allow with input as profile_reader with input.actionName as "create-discussion" }

test_profile_totals_scope_and_role if {
  request := object.union(profile_reader, {"actionName": "discussion.profile.totals.read", "resource": {"type": "profile-totals", "id": "OwnerUid", "tenantId": "default"}})
  allow with input as request
  not allow with input as object.union(request, {"subject": {"roles": []}})
  not allow with input as object.union(request, {"tenantId": "other"})
  not allow with input as object.union(request, {"resource": {"type": "profile-totals", "id": "OwnerUid", "tenantId": "other"}})
}

erasure_writer := {
  "identityId": "wapps-account-erasure-writer", "tenantId": "account-erasure",
  "actionName": "discussion.account-erasure.request", "subject": {"roles": ["account-erasure:writer"]},
  "resource": {"type": "account-erasure", "id": "Member", "tenantId": "account-erasure"},
}

test_account_erasure_fixed_service_allowed if allow with input as erasure_writer
test_account_erasure_member_denied if { not allow with input as erasure_writer with input.identityId as "Member" }
test_account_erasure_admin_denied if { not allow with input as erasure_writer with input.subject.roles as ["admin"] }
test_account_erasure_mixed_roles_denied if { not allow with input as erasure_writer with input.subject.roles as ["account-erasure:writer", "admin"] }
test_account_erasure_foreign_scope_denied if { not allow with input as erasure_writer with input.tenantId as "other" with input.resource.tenantId as "other" }
test_account_erasure_foreign_resource_denied if { not allow with input as erasure_writer with input.resource.type as "discussion" }
test_account_erasure_empty_owner_denied if { not allow with input as erasure_writer with input.resource.id as "" }
test_account_erasure_writer_cannot_write if { not allow with input as erasure_writer with input.actionName as "create-discussion" }

writer := {
	"identityId": "owner", "actionName": "create-discussion",
	"subject": {"roles": ["discussion:writer"]},
}

test_writer_can_create if allow with input as writer

my_topics := {
  "identityId": "member", "tenantId": "default",
  "actionName": "discussion.my-topics.read", "subject": {"roles": []},
  "resource": {"type": "my-discussion-workspace", "id": "member", "tenantId": "default"},
}

test_member_can_read_own_topics if allow with input as my_topics

test_my_topics_requires_matching_identity if {
  not allow with input as my_topics with input.resource.id as "other"
}

test_my_topics_requires_matching_tenant if {
  not allow with input as my_topics with input.resource.tenantId as "other"
}

test_my_topics_requires_identity if {
  not allow with input as my_topics with input.identityId as ""
}

test_my_topics_admin_cannot_read_other_account if {
  not allow with input as my_topics with input.resource.id as "other" with input.subject.roles as ["admin"]
}

test_my_topics_requires_correct_workspace if {
  not allow with input as my_topics with input.resource.type as "application-topic-workspace"
}

comment_actor := {
  "identityId": "member", "tenantId": "default",
  "actionName": "discussion.article-comment.create", "subject": {"roles": []},
  "resource": {"type": "article-comment-workspace", "id": "member", "tenantId": "default"},
}

test_authenticated_member_can_comment if allow with input as comment_actor

test_comment_actions_require_matching_actor if {
  not allow with input as comment_actor with input.resource.id as "other"
}

test_comment_actions_require_matching_tenant if {
  not allow with input as comment_actor with input.resource.tenantId as "other"
}

test_comment_actions_require_identity if {
  not allow with input as comment_actor with input.identityId as ""
}

test_comment_admin_cannot_bypass_workspace_scope if {
  not allow with input as comment_actor with input.resource.id as "other"
    with input.subject.roles as ["admin"]
}

topic_actor := {
  "identityId": "member", "tenantId": "default",
  "actionName": "discussion.application-topic.create", "subject": {"roles": []},
  "resource": {"type": "application-topic-workspace", "id": "member", "tenantId": "default"},
}

test_member_can_participate_in_application_topics if {
  every action in ["create", "reply", "update", "delete", "vote"] {
    allow with input as topic_actor with input.actionName as sprintf("discussion.application-topic.%s", [action])
  }
}

test_application_topic_requires_matching_identity if {
  not allow with input as topic_actor with input.resource.id as "other"
}

test_application_topic_requires_matching_tenant if {
  not allow with input as topic_actor with input.resource.tenantId as "other"
}

test_application_topic_requires_identity if {
  not allow with input as topic_actor with input.identityId as ""
}

test_application_topic_admin_cannot_bypass_workspace_scope if {
  not allow with input as topic_actor with input.resource.id as "other"
    with input.subject.roles as ["admin"]
}

test_application_topic_cannot_use_article_workspace if {
  not allow with input as topic_actor with input.resource.type as "article-comment-workspace"
}

test_article_comment_cannot_use_application_workspace if {
  not allow with input as comment_actor with input.resource.type as "application-topic-workspace"
}

test_example_identity_has_no_implicit_permissions if {
	not allow with input as {"identityId": "example-user", "actionName": "create-discussion"}
}

test_reader_cannot_create if {
	not allow with input as writer with input.subject.roles as ["discussion:reader"]
}

test_reader_can_like_comment if {
	allow with input as writer with input.actionName as "discussion.comment.like"
		with input.subject.roles as ["discussion:reader"]
		with input.resource as {"type": "comment", "id": "comment-id"}
}

test_null_identity_denied if {
	not allow with input as writer with input.identityId as null
}

test_object_roles_denied if {
	not allow with input as writer with input.subject.roles as {"role": "admin"}
}

test_missing_comment_id_denied if {
	not allow with input as writer with input.actionName as "discussion.comment.like"
		with input.resource as {"type": "comment"}
}

test_null_comment_id_denied if {
	not allow with input as writer with input.actionName as "discussion.comment.like"
		with input.resource as {"type": "comment", "id": null}
}

test_unsupported_action_denied_even_for_admin if {
	not allow with input as writer with input.actionName as "unsupported"
		with input.subject.roles as ["admin"]
}


test_application_vote_cannot_spoof_identity_or_tenant if {
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.vote" with input.resource.id as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.vote" with input.resource.tenantId as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.vote" with input.identityId as ""
}

test_only_admin_can_pin_application_topics if {
  allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"]
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["discussion:writer"]
}

test_pin_admin_cannot_bypass_tenant_identity_or_workspace if {
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"] with input.resource.tenantId as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"] with input.resource.id as "other"
  not allow with input as topic_actor with input.actionName as "discussion.application-topic.pin" with input.subject.roles as ["admin"] with input.resource.type as "article-comment-workspace"
}

review_actor := {
  "identityId": "Member", "tenantId": "default", "actionName": "review.publish",
  "subject": {"roles": []},
  "resource": {"id": "Member", "tenantId": "default", "type": "application-review-workspace"}
}

test_review_member_actions if {
  every action in ["read", "publish", "withdraw", "helpful", "report"] {
    allow with input as review_actor with input.actionName as sprintf("review.%s", [action])
  }
}

test_review_moderation_requires_staff if {
  not allow with input as review_actor with input.actionName as "review.moderate"
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["discussion:writer"]
  allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"]
}

test_review_identity_and_tenant_cannot_be_spoofed if {
  not allow with input as review_actor with input.resource.id as "Other"
  not allow with input as review_actor with input.resource.tenantId as "other"
  not allow with input as review_actor with input.identityId as ""
}

test_review_admin_cannot_bypass_scope if {
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"] with input.resource.id as "Other"
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"] with input.resource.type as "application-topic-workspace"
  not allow with input as review_actor with input.actionName as "review.moderate" with input.subject.roles as ["admin"] with input.resource.tenantId as "other"
}

profile_reader := {"identityId": "wapps-profile-reader", "tenantId": "default", "subject": {"roles": ["discussion:profile-reader"]}, "actionName": "discussion.profile.participation.read", "resource": {"type": "profile-discussion-collection", "id": "OwnerUid", "tenantId": "default"}}
test_profile_reader_allowed if { allow with input as profile_reader }
test_profile_activity_scope_and_role if {
  request := object.union(profile_reader, {"actionName": "discussion.profile.activity.read", "resource": {"type": "profile-activity", "id": "OwnerUid", "tenantId": "default"}})
  allow with input as request
  not allow with input as request with input.resource.tenantId as "private"
  not allow with input as request with input.subject.roles as ["discussion:writer"]
  not allow with input as request with input.resource.type as "profile-discussion-collection"
}
test_profile_reader_role_required if { not allow with input as profile_reader with input.subject.roles as [] }
test_profile_reader_scope_required if { not allow with input as profile_reader with input.resource.tenantId as "other" }
test_profile_reader_resource_required if { not allow with input as profile_reader with input.resource.type as "my-discussion-workspace" }
test_profile_reader_has_no_ordinary_write if { not allow with input as profile_reader with input.actionName as "create-discussion" }

test_profile_totals_scope_and_role if {
  request := object.union(profile_reader, {"actionName": "discussion.profile.totals.read", "resource": {"type": "profile-totals", "id": "OwnerUid", "tenantId": "default"}})
  allow with input as request
  not allow with input as object.union(request, {"subject": {"roles": []}})
  not allow with input as object.union(request, {"tenantId": "other"})
  not allow with input as object.union(request, {"resource": {"type": "profile-totals", "id": "OwnerUid", "tenantId": "other"}})
}


notification_worker := {"identityId": "wapps-notification-worker", "tenantId": "notifications", "subject": {"roles": ["notification:worker"]}, "actionName": "discussion.notifications.manage", "resource": {"type": "reply-notifications", "id": "discussion", "tenantId": "notifications"}}
test_notification_worker_exact_scope if {
  allow with input as notification_worker
  not allow with input as notification_worker with input.identityId as "Member"
  not allow with input as notification_worker with input.subject.roles as ["admin"]
  not allow with input as notification_worker with input.tenantId as "default"
  not allow with input as notification_worker with input.resource.tenantId as "default"
  not allow with input as notification_worker with input.resource.type as "account-erasure"
}
test_notification_worker_has_no_content_write if {
  not allow with input as notification_worker with input.actionName as "create-discussion"
  not allow with input as notification_worker with input.actionName as "discussion.account-erasure.request"
  not allow with input as notification_worker with input.actionName as "discussion.account-export.read"
}

favorite_update_worker := {"identityId": "wapps-notification-worker", "tenantId": "notifications", "subject": {"roles": ["notification:worker"]}, "actionName": "discussion.favorite-updates.read", "resource": {"type": "favorite-updates", "id": "discussion", "tenantId": "notifications"}}
test_favorite_update_service_exact_scope if {
  allow with input as favorite_update_worker
  not allow with input as favorite_update_worker with input.identityId as "Member"
  not allow with input as favorite_update_worker with input.subject.roles as ["admin"]
  not allow with input as favorite_update_worker with input.tenantId as "default"
  not allow with input as favorite_update_worker with input.resource.tenantId as "default"
  not allow with input as favorite_update_worker with input.resource.type as "account-export"
  not allow with input as favorite_update_worker with input.resource.id as "other"
}

mention_worker := {"identityId": "wapps-notification-worker", "tenantId": "notifications", "subject": {"roles": ["notification:worker"]}, "actionName": "discussion.mentions.manage", "resource": {"type": "mention-notifications", "id": "discussion", "tenantId": "notifications"}}
test_mention_worker_exact_scope if {
  allow with input as mention_worker
  not allow with input as mention_worker with input.resource.id as "other"
  not allow with input as mention_worker with input.identityId as "Member"
  not allow with input as mention_worker with input.subject.roles as ["admin"]
  not allow with input as mention_worker with input.tenantId as "default"
  not allow with input as mention_worker with input.resource.tenantId as "default"
  not allow with input as mention_worker with input.resource.type as "account-erasure"
}
test_mention_worker_has_no_content_write if {
  not allow with input as mention_worker with input.actionName as "create-discussion"
  not allow with input as mention_worker with input.actionName as "discussion.account-erasure.request"
  not allow with input as mention_worker with input.actionName as "discussion.account-export.read"
}


explore_reader := {"identityId": "wapps-explore-reader", "tenantId": "explore", "subject": {"roles": ["explore:reader"]}, "actionName": "discussion.explore.read", "resource": {"type": "explore", "id": "discussion", "tenantId": "explore"}}
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
