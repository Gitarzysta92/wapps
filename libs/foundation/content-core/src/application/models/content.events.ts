import type { ContentId } from './content-id';
import type { ContentState, ContentVisibility } from '../constants';

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

export type ContentRelationAdded = {
  type: 'ContentRelationAdded';
  contentId: ContentId;
  kind: string;
  targetId: ContentId;
};

export type ContentRelationRemoved = {
  type: 'ContentRelationRemoved';
  contentId: ContentId;
  kind: string;
  targetId: ContentId;
};

export type ContentLifecycleEvent =
  | ContentCreated
  | ContentStateChanged
  | ContentVisibilityChanged
  | ContentRelationAdded
  | ContentRelationRemoved;
