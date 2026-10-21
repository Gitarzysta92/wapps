import type {
  DiscussionPayloadReference,
  DiscussionSnapshotNode,
} from '@sdk/features/discussion/core';

export interface DiscussionActor {
  identityId: string;
  tenantId: string;
  roles: string[];
}

export interface DiscussionResource {
  bindingKey?: string | null;
  pinned?: boolean;
  id: string;
  discussionId: string;
  revision: number;
  tenantId: string;
  ownerIdentityId: string | null;
  rootOwnerIdentityId: string | null;
  kind: 'discussion' | 'comment';
  state: DiscussionSnapshotNode['state'];
  visibility: DiscussionSnapshotNode['visibility'];
  rootState: DiscussionSnapshotNode['state'];
  rootVisibility: DiscussionSnapshotNode['visibility'];
  deletedAt: number | null;
  rootDeletedAt: number | null;
}

export interface DiscussionCommit {
  id: string;
  discussionId: string;
  revision: number;
  projection: 'pending';
}

export interface DiscussionCommandIdentity {
  actor: DiscussionActor;
  key: string;
  fingerprint: string;
}

export type PreparedDiscussionMutation = {
  command: DiscussionCommandIdentity;
  nodeId: string;
  at: number;
} & (
  | {
      type: 'create';
      bindingKey?: string;
      referenceKey: string;
      subjectId: string | null;
      state: DiscussionSnapshotNode['state'];
      visibility: DiscussionSnapshotNode['visibility'];
      payload: DiscussionPayloadReference;
      context?: unknown;
    }
  | {
      type: 'reply';
      resource: DiscussionResource;
      referenceKey: string;
      payload: DiscussionPayloadReference;
      context?: unknown;
    }
  | {
      type: 'update';
      resource: DiscussionResource;
      payload: DiscussionPayloadReference;
      context?: unknown;
      state: DiscussionSnapshotNode['state'];
      visibility: DiscussionSnapshotNode['visibility'];
    }
  | { type: 'delete' | 'like' | 'unlike'; resource: DiscussionResource }
  | { type: 'vote'; resource: DiscussionResource; value: -1 | 0 | 1 }
  | { type: 'pin'; resource: DiscussionResource; pinned: boolean }
);

export interface DiscussionWriteRepository {
  resource(id: string): Promise<DiscussionResource | null>;
  resources(discussionId: string): Promise<DiscussionResource[]>;
  receipt(command: DiscussionCommandIdentity): Promise<DiscussionCommit | null>;
  /** Rechecks resource revision/scope under lock and commits nodes, receipt and outbox together. */
  commit(mutation: PreparedDiscussionMutation): Promise<DiscussionCommit>;
}

export interface ImmutableDiscussionPayloads {
  put(
    nodeId: string,
    body: Buffer,
    scope: DiscussionPayloadScope
  ): Promise<DiscussionPayloadReference>;
}

export interface DiscussionPayloadScope {
  tenantId: string;
  ownerIdentityId: string;
  actorIdentityId: string | null;
}

export class DiscussionConflictError extends Error {}
export class DiscussionNotFoundError extends Error {}
export class DiscussionValidationError extends Error {}
