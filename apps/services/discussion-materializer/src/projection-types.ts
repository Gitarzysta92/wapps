export type DiscussionNodeKind = 'discussion' | 'comment';

export type DiscussionNodeProjection = {
  _id: string; // content node id
  kind: DiscussionNodeKind | string;

  /** Root discussion id (for kind=discussion equals _id) */
  discussionId: string;

  /** Direct parent id (null for discussion roots) */
  parentId: string | null;

  /** Optional UI helper (computed from reply chain). */
  depth: number;

  /** External/stable association key (usually content-node referenceKey of the discussed subject). */
  subjectReferenceKey: string | null;
  /** Internal id of the subject node (if available). */
  subjectId: string | null;

  /** Content-system referenceKey of this node. */
  referenceKey: string;

  state: string;
  visibility: string;
  createdAt: number;
  updatedAt?: number | null;
  deletedAt?: number | null;

  /** Stored payload (keep bounded). */
  payload: unknown;

  materializedAt: string; // ISO
  materializedFromEventId: string;
  materializedFromOccurredAt: string;
};

/**
 * A tiny denormalized aggregate to support fast root-level sorting (newest/active/replies).
 * Keep this small and stable.
 */
export type DiscussionAggregateProjection = {
  _id: string; // discussionId
  subjectReferenceKey: string | null;
  subjectId: string | null;
  createdAt: number;
  lastActivityAt: number;
  descendantsCount: number;
};

