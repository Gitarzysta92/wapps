package wapps.profile_audience.authz

test_activity_requires_boolean_sharing_and_current_audience if {
  allow with input as object.union(facts, {"action": "read-activity", "visibility": "public", "activityShared": true})
  not allow with input as object.union(facts, {"action": "read-activity", "visibility": "public", "activityShared": "true"})
  not allow with input as object.union(facts, {"action": "read-activity", "viewerId": owner, "activityShared": false})
  not allow with input as object.union(facts, {"action": "read-activity", "activityShared": true})
  not allow with input as object.union(facts, {"action": "read-activity", "visibility": "public", "ownerActive": false, "activityShared": true})
}
test_activity_follower_approval_is_current if {
  allow with input as object.union(facts, {"action": "read-activity", "visibility": "followers", "viewerId": requester, "approved": true, "activityShared": true})
  not allow with input as object.union(facts, {"action": "read-activity", "visibility": "followers", "viewerId": requester, "approved": false, "activityShared": true})
}

owner := "00000000-0000-4000-8000-000000000001"
requester := "00000000-0000-4000-8000-000000000002"
other := "00000000-0000-4000-8000-000000000003"
facts := {"ownerId": owner, "viewerId": null, "visibility": "private", "ownerActive": true, "viewerActive": true, "viewerRegistered": false, "approved": false, "action": "read", "requesterId": requester}

test_anonymous_public if { allow with input as object.union(facts, {"visibility": "public"}) }
test_anonymous_private_denied if { not allow with input as facts }
test_anonymous_followers_denied if { not allow with input as object.union(facts, {"visibility": "followers", "approved": true}) }
test_unapproved_follower_denied if { not allow with input as object.union(facts, {"visibility": "followers", "viewerId": requester}) }
test_approved_follower if { allow with input as object.union(facts, {"visibility": "followers", "viewerId": requester, "approved": true}) }
test_approved_cannot_read_private if { not allow with input as object.union(facts, {"viewerId": requester, "approved": true}) }
test_owner_preview if { allow with input as object.union(facts, {"viewerId": owner}) }
test_admin_has_no_override if { not allow with input as object.union(facts, {"viewerId": requester, "subject": {"roles": ["admin", "identity:admin"]}}) }
test_disabled_owner_denied if { not allow with input as object.union(facts, {"visibility": "public", "ownerActive": false}) }
test_disabled_viewer_denied if { not allow with input as object.union(facts, {"visibility": "public", "viewerId": requester, "viewerActive": false}) }
test_owner_private_not_discoverable if { not allow with input as object.union(facts, {"viewerId": owner, "action": "discover"}) }
test_public_discoverable if { allow with input as object.union(facts, {"visibility": "public", "action": "discover"}) }
test_follow_gate if { allow with input as object.union(facts, {"visibility": "followers", "action": "request-access"}) }
test_private_not_requestable if { not allow with input as object.union(facts, {"action": "request-access"}) }
test_registered_requester if { allow with input as object.union(facts, {"action": "request", "visibility": "followers", "viewerId": requester, "viewerRegistered": true}) }
test_unregistered_requester_denied if { not allow with input as object.union(facts, {"action": "request", "visibility": "followers", "viewerId": requester}) }
test_forged_requester_denied if { not allow with input as object.union(facts, {"action": "request", "visibility": "followers", "viewerId": other, "viewerRegistered": true}) }
test_owner_cannot_follow_itself if { not allow with input as object.union(facts, {"action": "request", "visibility": "followers", "viewerId": owner, "requesterId": owner, "viewerRegistered": true}) }
test_owner_approval if { allow with input as object.union(facts, {"action": "approve", "viewerId": owner, "viewerRegistered": true}) }
test_requester_cannot_approve if { not allow with input as object.union(facts, {"action": "approve", "viewerId": requester, "viewerRegistered": true}) }
test_foreign_cannot_remove if { not allow with input as object.union(facts, {"action": "remove", "viewerId": other, "viewerRegistered": true}) }
test_cancel_after_owner_suspension if { allow with input as object.union(facts, {"action": "cancel", "viewerId": requester, "viewerRegistered": true, "ownerActive": false}) }
test_unknown_action_denied if { not allow with input as object.union(facts, {"action": "admin-grant", "viewerId": owner, "viewerRegistered": true}) }


test_shared_favorites_public if { allow with input as object.union(facts, {"action": "read-favorites", "visibility": "public", "favoritesShared": true}) }
test_hidden_favorites_denied if { not allow with input as object.union(facts, {"action": "read-favorites", "visibility": "public", "favoritesShared": false}) }
test_missing_favorites_preference_denied if { not allow with input as object.union(facts, {"action": "read-favorites", "visibility": "public"}) }
test_invalid_favorites_preference_denied if { not allow with input as object.union(facts, {"action": "read-favorites", "visibility": "public", "favoritesShared": "true"}) }
test_private_favorites_other_denied if { not allow with input as object.union(facts, {"action": "read-favorites", "favoritesShared": true, "viewerId": requester}) }
test_approved_favorites if { allow with input as object.union(facts, {"action": "read-favorites", "visibility": "followers", "viewerId": requester, "approved": true, "favoritesShared": true}) }
test_owner_preview_respects_favorites_switch if { not allow with input as object.union(facts, {"action": "read-favorites", "viewerId": owner, "favoritesShared": false}) }

test_public_suites_shared if { allow with input as object.union(facts, {"action": "read-suites", "visibility": "public", "suitesShared": true}) }
test_suites_switch_required if { not allow with input as object.union(facts, {"action": "read-suites", "visibility": "public"}) }
test_suites_boolean_required if { not allow with input as object.union(facts, {"action": "read-suites", "visibility": "public", "suitesShared": "true"}) }
test_private_suites_other_denied if { not allow with input as object.union(facts, {"action": "read-suites", "suitesShared": true, "viewerId": requester}) }
test_suites_approved_follower if { allow with input as object.union(facts, {"action": "read-suites", "visibility": "followers", "viewerId": requester, "approved": true, "suitesShared": true}) }
test_suites_unapproved_follower_denied if { not allow with input as object.union(facts, {"action": "read-suites", "visibility": "followers", "viewerId": requester, "suitesShared": true}) }
test_owner_respects_suites_switch if { not allow with input as object.union(facts, {"action": "read-suites", "viewerId": owner, "suitesShared": false}) }

test_public_discussions_shared if { allow with input as object.union(facts, {"action": "read-discussions", "visibility": "public", "discussionsShared": true}) }
test_discussions_switch_required if { not allow with input as object.union(facts, {"action": "read-discussions", "visibility": "public"}) }
test_discussions_boolean_required if { not allow with input as object.union(facts, {"action": "read-discussions", "visibility": "public", "discussionsShared": "true"}) }
test_private_discussions_other_denied if { not allow with input as object.union(facts, {"action": "read-discussions", "discussionsShared": true, "viewerId": requester}) }
test_discussions_approved_follower if { allow with input as object.union(facts, {"action": "read-discussions", "visibility": "followers", "viewerId": requester, "approved": true, "discussionsShared": true}) }
test_discussions_unapproved_follower_denied if { not allow with input as object.union(facts, {"action": "read-discussions", "visibility": "followers", "viewerId": requester, "discussionsShared": true}) }
test_owner_respects_discussions_switch if { not allow with input as object.union(facts, {"action": "read-discussions", "viewerId": owner, "discussionsShared": false}) }


test_badges_public_shared if { allow with input as object.union(facts, {"action": "read-badges", "visibility": "public", "badgesShared": true}) }
test_badges_missing_switch_denied if { not allow with input as object.union(facts, {"action": "read-badges", "visibility": "public"}) }
test_badges_require_boolean if { not allow with input as object.union(facts, {"action": "read-badges", "visibility": "public", "badgesShared": "true"}) }
test_badges_owner_preview_respects_switch if { not allow with input as object.union(facts, {"action": "read-badges", "viewerId": owner, "badgesShared": false}) }
test_badges_private_staff_denied if { not allow with input as object.union(facts, {"action": "read-badges", "viewerId": requester, "badgesShared": true, "subject": {"roles": ["admin", "identity:badge-manager"]}}) }
test_badges_approved_follower if { allow with input as object.union(facts, {"action": "read-badges", "visibility": "followers", "viewerId": requester, "approved": true, "badgesShared": true}) }
test_badges_unapproved_follower_denied if { not allow with input as object.union(facts, {"action": "read-badges", "visibility": "followers", "viewerId": requester, "badgesShared": true}) }
test_badges_inactive_owner_denied if { not allow with input as object.union(facts, {"action": "read-badges", "visibility": "public", "ownerActive": false, "badgesShared": true}) }
