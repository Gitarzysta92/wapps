import { createHash } from 'node:crypto';
import {
  DISCUSSION_MAX_DEPTH,
  DISCUSSION_MAX_GENERATION_BYTES,
  DISCUSSION_MAX_NODES,
  DISCUSSION_MAX_PAYLOAD_BYTES,
  DISCUSSION_PROJECTION_SCHEMA,
  DiscussionGenerationHead,
  DiscussionGenerationNode,
  DiscussionPayloadReference,
  DiscussionSnapshot,
  DiscussionSnapshotNode,
} from '@apps/shared';

export class InvalidSnapshotError extends Error {}

export interface DiscussionSnapshotReader {
  read(discussionId: string): Promise<DiscussionSnapshot>;
}

export interface ImmutablePayloadReader {
  read(reference: DiscussionPayloadReference): Promise<Buffer>;
}

export interface DiscussionGenerationStore {
  writeNodes(nodes: DiscussionGenerationNode[]): Promise<void>;
  /** Must reject conflicting content at the same revision and never regress. */
  publish(
    head: DiscussionGenerationHead
  ): Promise<'published' | 'superseded' | 'unchanged'>;
}

function requireSnapshot(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) throw new InvalidSnapshotError(message);
}

function timestamp(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

function validate(snapshot: DiscussionSnapshot): Map<string, number> {
  requireSnapshot(
    snapshot.subjectKind === undefined ||
      (['article', 'application'].includes(snapshot.subjectKind) &&
        !!snapshot.subjectId),
    'Invalid discussion target'
  );
  requireSnapshot(
    Number.isSafeInteger(snapshot.revision) && snapshot.revision > 0,
    'Invalid aggregate revision'
  );
  requireSnapshot(
    snapshot.discussionId.length > 0 && snapshot.tenantId.length > 0,
    'Missing aggregate scope'
  );
  requireSnapshot(
    snapshot.nodes.length > 0 && snapshot.nodes.length <= DISCUSSION_MAX_NODES,
    'Invalid aggregate size'
  );
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  requireSnapshot(
    byId.size === snapshot.nodes.length,
    'Duplicate node identity'
  );
  const root = byId.get(snapshot.discussionId);
  requireSnapshot(
    !!root && root.kind === 'discussion' && root.parentId === null,
    'Missing discussion root'
  );
  let bytes = 0;
  for (const node of snapshot.nodes) {
    requireSnapshot(
      node.id.length > 0 &&
        (node.ownerIdentityId === null ||
          (typeof node.ownerIdentityId === 'string' &&
            node.ownerIdentityId.length > 0)),
      'Missing node identity or owner'
    );
    requireSnapshot(
      ['draft', 'published', 'archived'].includes(node.state),
      'Invalid node state'
    );
    requireSnapshot(
      ['public', 'private', 'unlisted'].includes(node.visibility),
      'Invalid node visibility'
    );
    requireSnapshot(
      Number.isSafeInteger(node.createdAt) &&
        node.createdAt >= 0 &&
        timestamp(node.updatedAt) &&
        timestamp(node.deletedAt),
      'Invalid node timestamp'
    );
    requireSnapshot(
      Number.isSafeInteger(node.likeCount) && node.likeCount >= 0,
      'Invalid like count'
    );
    requireSnapshot(
      node.id === snapshot.discussionId ||
        (node.kind === 'comment' && node.parentId !== null),
      'Invalid reply structure'
    );
    if (node.deletedAt === null) {
      requireSnapshot(
        node.payload !== null,
        'Live node has no committed payload'
      );
      requireSnapshot(
        node.payload.key.length > 0 &&
          /^[a-f0-9]{64}$/.test(node.payload.sha256),
        'Invalid payload reference'
      );
      requireSnapshot(
        Number.isSafeInteger(node.payload.bytes) &&
          node.payload.bytes > 0 &&
          node.payload.bytes <= DISCUSSION_MAX_PAYLOAD_BYTES,
        'Payload exceeds limit'
      );
      bytes += node.payload.bytes;
    }
  }
  requireSnapshot(
    bytes <= DISCUSSION_MAX_GENERATION_BYTES,
    'Generation exceeds payload limit'
  );
  const depths = new Map<string, number>([[snapshot.discussionId, 0]]);
  for (const node of snapshot.nodes) {
    const path: string[] = [];
    const seen = new Set<string>();
    let current: DiscussionSnapshotNode | undefined = node;
    while (current && !depths.has(current.id)) {
      requireSnapshot(!seen.has(current.id), 'Cyclic reply structure');
      requireSnapshot(
        path.length < DISCUSSION_MAX_DEPTH,
        'Reply depth exceeds limit'
      );
      seen.add(current.id);
      path.push(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    requireSnapshot(!!current, 'Reply references a missing parent');
    let depth = depths.get(current.id) ?? 0;
    while (path.length) {
      requireSnapshot(
        ++depth <= DISCUSSION_MAX_DEPTH,
        'Reply depth exceeds limit'
      );
      const id = path.pop();
      if (id) depths.set(id, depth);
    }
  }
  return depths;
}

function canonicalNode(node: DiscussionSnapshotNode): DiscussionSnapshotNode {
  return {
    id: node.id,
    referenceKey: node.referenceKey,
    kind: node.kind,
    parentId: node.parentId,
    ownerIdentityId: node.ownerIdentityId,
    state: node.state,
    visibility: node.visibility,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    deletedAt: node.deletedAt,
    likeCount: node.likeCount,
    payload:
      node.deletedAt === null && node.payload
        ? {
            key: node.payload.key,
            sha256: node.payload.sha256,
            bytes: node.payload.bytes,
          }
        : null,
  };
}

export async function materializeDiscussion(
  discussionId: string,
  reader: DiscussionSnapshotReader,
  payloads: ImmutablePayloadReader,
  store: DiscussionGenerationStore
): Promise<'published' | 'superseded' | 'unchanged'> {
  const snapshot = await reader.read(discussionId);
  requireSnapshot(
    snapshot.discussionId === discussionId,
    'Snapshot belongs to another aggregate'
  );
  const depths = validate(snapshot);
  const sourceNodes = snapshot.nodes
    .map(canonicalNode)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: DISCUSSION_PROJECTION_SCHEMA,
        discussionId,
        tenantId: snapshot.tenantId,
        revision: snapshot.revision,
        subjectId: snapshot.subjectId,
        ...(snapshot.subjectKind ? { subjectKind: snapshot.subjectKind } : {}),
        subjectReferenceKey: snapshot.subjectReferenceKey,
        nodes: sourceNodes,
      })
    )
    .digest('hex');
  // Including the fingerprint prevents conflicting sources mixing one generation.
  const generation = `${discussionId}:${snapshot.revision}:${fingerprint}`;
  const root = sourceNodes.find((node) => node.id === discussionId);
  requireSnapshot(!!root, 'Missing discussion root');
  const nodes: DiscussionGenerationNode[] = [];
  for (const node of sourceNodes) {
    let payload: unknown = null;
    if (root.deletedAt === null && node.deletedAt === null && node.payload) {
      const body = await payloads.read(node.payload);
      requireSnapshot(
        body.length === node.payload.bytes &&
          createHash('sha256').update(body).digest('hex') ===
            node.payload.sha256,
        'Payload hash or size mismatch'
      );
      try {
        payload = JSON.parse(body.toString('utf8'));
      } catch {
        throw new InvalidSnapshotError('Payload is not valid JSON');
      }
      requireSnapshot(
        typeof payload === 'object' &&
          payload !== null &&
          !Array.isArray(payload) &&
          Object.prototype.hasOwnProperty.call(payload, 'content'),
        'Invalid discussion payload'
      );
    }
    nodes.push({
      ...node,
      _id: node.id,
      schemaVersion: DISCUSSION_PROJECTION_SCHEMA,
      discussionId,
      generation,
      revision: snapshot.revision,
      depth: depths.get(node.id) ?? 0,
      payload,
    });
  }
  // Stable node records never regress; readers pin the generation and reject incomplete snapshots.
  for (let offset = 0; offset < nodes.length; offset += 100) {
    await store.writeNodes(nodes.slice(offset, offset + 100));
  }
  return store.publish({
    _id: discussionId,
    schemaVersion: DISCUSSION_PROJECTION_SCHEMA,
    tenantId: snapshot.tenantId,
    generation,
    fingerprint,
    revision: snapshot.revision,
    subjectId: snapshot.subjectId,
    ...(snapshot.subjectKind ? { subjectKind: snapshot.subjectKind } : {}),
    subjectReferenceKey: snapshot.subjectReferenceKey,
    visibility: root.visibility,
    state: root.state,
    deletedAt: root.deletedAt,
    createdAt: root.createdAt,
    lastActivityAt: Math.max(
      ...nodes.map((node) =>
        Math.max(node.createdAt, node.updatedAt ?? 0, node.deletedAt ?? 0)
      )
    ),
    descendantsCount:
      root.deletedAt === null
        ? nodes.filter(
            (node) =>
              node.kind === 'comment' &&
              node.deletedAt === null &&
              node.state === 'published'
          ).length
        : 0,
    nodeCount: nodes.length,
  });
}
