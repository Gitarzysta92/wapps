# GENERATED FILE. DO NOT EDIT MANUALLY.
# Source: sdk/features/identity/packages/infrastructure/opa/src/profile-audience.policy.ts
package wapps.profile_audience.authz

default allow := false

valid_id(id) if {
  is_string(id)
  regex.match("^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$", id)
}

valid if {
  valid_id(input.ownerId)
  input.visibility in {"public", "private", "followers"}
  is_boolean(input.ownerActive)
  input.viewerActive == true
  is_boolean(input.viewerRegistered)
  is_boolean(input.approved)
  viewer_valid
}

viewer_valid if { input.viewerId == null }
viewer_valid if { valid_id(input.viewerId) }

allow if {
  valid
  input.ownerActive == true
  input.action == "read"
  readable
}
readable if { input.viewerId == input.ownerId }
allow if {
  valid
  input.ownerActive == true
  input.action == "read-badges"
  input.badgesShared == true
  readable
}
allow if {
  valid
  input.ownerActive == true
  input.action == "read-favorites"
  input.favoritesShared == true
  readable
}
readable if { input.visibility == "public" }
allow if {
  valid
  input.ownerActive == true
  input.action == "read-suites"
  input.suitesShared == true
  readable
}
allow if {
  valid
  input.ownerActive == true
  input.action == "read-discussions"
  input.discussionsShared == true
  readable
}
allow if {
  valid
  input.ownerActive == true
  input.action == "read-activity"
  input.activityShared == true
  readable
}
readable if {
  input.visibility == "followers"
  valid_id(input.viewerId)
  input.approved == true
}

allow if {
  valid
  input.ownerActive == true
  input.action == "discover"
  input.visibility == "public"
}

allow if {
  valid
  input.ownerActive == true
  input.action == "request-access"
  input.visibility == "followers"
}

allow if {
  valid
  input.ownerActive == true
  input.action == "request"
  input.visibility == "followers"
  input.viewerRegistered == true
  valid_id(input.requesterId)
  input.viewerId == input.requesterId
  input.requesterId != input.ownerId
}

allow if {
  valid
  input.action == "cancel"
  input.viewerRegistered == true
  valid_id(input.requesterId)
  input.viewerId == input.requesterId
  input.requesterId != input.ownerId
}

allow if {
  valid
  input.ownerActive == true
  input.action in {"approve", "remove"}
  input.viewerRegistered == true
  input.viewerId == input.ownerId
  valid_id(input.requesterId)
  input.requesterId != input.ownerId
}
