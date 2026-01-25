import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';

export const DISCUSSION_SUBDOMAIN_SLUG = 'discussion';
export const DISCUSSION_NODE_KIND = 'discussion';
export const COMMENT_NODE_KIND = 'comment';
export const DISCUSSES_RELATION_TYPE = 'discusses';
export const REPLIES_RELATION_TYPE = 'replies';
export const TAGGED_RELATION_TYPE = 'tagged';
export const CREATE_DISCUSSION_ACTION_NAME = 'create-discussion';
export const CREATE_COMMENT_ACTION_NAME = 'create-comment';
export const DEFAULT_CONTENT_NODE_STATE = ContentNodeState.DRAFT;
export const DEFAULT_CONTENT_NODE_VISIBILITY = ContentNodeVisibility.PUBLIC;
