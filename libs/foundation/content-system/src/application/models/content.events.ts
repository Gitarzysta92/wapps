import type { ContentId } from './content-id';
import type { ContentRelationId } from './content-node-relation';
import type { ContentState, ContentVisibility, RelationType } from '../constants';

/** Lifecycle events for eventual consistency and projection rebuilds. */
export type ContentCreated = { type: 'ContentCreated'; contentId: ContentId };

export type ContentStateChanged = {
  type: 'ContentStateChanged';
  contentId: ContentId;
  state: ContentState;
};

export type ContentVisibilityChanged = {
  type: 'ContentVisibilityChanged';
  contentId: ContentId;
  visibility: ContentVisibility;
};

/** Relation added (append-only; no ContentRelationRemoved per ADR-0002). */
export type ContentRelationAdded = {
  type: 'ContentRelationAdded';
  relationId: ContentRelationId;
  fromContentId: ContentId;
  toContentId: ContentId;
  relationType: RelationType;
};

export type ContentLifecycleEvent =
  | ContentCreated
  | ContentStateChanged
  | ContentVisibilityChanged
  | ContentRelationAdded;
