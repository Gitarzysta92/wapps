import type { Uuidv7 } from '@sdk/kernel/standard';
import type { ContentNodeRelationType, ContentNodeState, ContentNodeVisibility } from '../constants';

export type ContentId = Uuidv7;
export type ContentRelationId = Uuidv7;

/** Lifecycle events for eventual consistency and projection rebuilds. */
export type ContentCreated = { type: 'ContentCreated'; contentId: ContentId };

export type ContentStateChanged = {
  type: 'ContentStateChanged';
  contentId: ContentId;
  state: ContentNodeState;
};

export type ContentVisibilityChanged = {
  type: 'ContentVisibilityChanged';
  contentId: ContentId;
  visibility: ContentNodeVisibility;
};

/** Relation added (append-only; no ContentRelationRemoved per ADR-0002). */
export type ContentRelationAdded = {
  type: 'ContentRelationAdded';
  relationId: ContentRelationId;
  fromContentId: ContentId;
  toContentId: ContentId;
  relationType: ContentNodeRelationType | string;
};

export type ContentLifecycleEvent =
  | ContentCreated
  | ContentStateChanged
  | ContentVisibilityChanged
  | ContentRelationAdded;
