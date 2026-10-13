export const DISCUSSION_PROJECTION_SCHEMA = 3;
export const DISCUSSION_MAX_NODES = 2000;
export const DISCUSSION_MAX_DEPTH = 64;
export const DISCUSSION_MAX_PAYLOAD_BYTES = 256 * 1024;
export const DISCUSSION_MAX_GENERATION_BYTES = 16 * 1024 * 1024;

export interface DiscussionPayloadReference {
  key: string;
  sha256: string;
  bytes: number;
}

/** A consistent committed write-model snapshot, including tombstones. */
export interface DiscussionSnapshotNode {
  id: string;
  referenceKey: string;
  kind: 'discussion' | 'comment';
  parentId: string | null;
  ownerIdentityId: string | null;
  state: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: number;
  updatedAt: number | null;
  deletedAt: number | null;
  likeCount: number;
  payload: DiscussionPayloadReference | null;
}

export interface DiscussionSnapshot {
  subjectKind?: 'article' | 'application';
  discussionId: string;
  tenantId: string;
  revision: number;
  subjectId: string | null;
  subjectReferenceKey: string | null;
  nodes: DiscussionSnapshotNode[];
}

export interface DiscussionGenerationNode
  extends Omit<DiscussionSnapshotNode, 'payload'> {
  _id: string;
  schemaVersion: typeof DISCUSSION_PROJECTION_SCHEMA;
  discussionId: string;
  generation: string;
  revision: number;
  depth: number;
  payload: unknown;
}

/** Published after all node writes are durable; readers validate the complete pinned generation. */
export interface DiscussionGenerationHead {
  subjectKind?: 'article' | 'application';
  _id: string;
  schemaVersion: typeof DISCUSSION_PROJECTION_SCHEMA;
  tenantId: string;
  generation: string;
  fingerprint: string;
  revision: number;
  subjectId: string | null;
  subjectReferenceKey: string | null;
  visibility: DiscussionSnapshotNode['visibility'];
  state: DiscussionSnapshotNode['state'];
  deletedAt: number | null;
  createdAt: number;
  lastActivityAt: number;
  descendantsCount: number;
  nodeCount: number;
}
