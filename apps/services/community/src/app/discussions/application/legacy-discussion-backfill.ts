import { createHash } from 'node:crypto';
import {
  DISCUSSION_MAX_DEPTH,
  DISCUSSION_MAX_GENERATION_BYTES,
  DISCUSSION_MAX_NODES,
  DISCUSSION_MAX_PAYLOAD_BYTES,
  DiscussionPayloadReference,
  DiscussionSnapshotNode,
} from '@apps/shared';
import {
  DiscussionConflictError,
  DiscussionValidationError,
  ImmutableDiscussionPayloads,
} from './discussion-write.port';

export interface DiscussionOwnershipManifest {
  version: 1;
  discussionId: string;
  tenantId: string;
  owners: Array<{ nodeId: string; identityId: string }>;
}

export type LegacyDiscussionNode = Omit<
  DiscussionSnapshotNode,
  'parentId' | 'ownerIdentityId' | 'payload'
>;

export interface LegacyDiscussionRelation {
  id: string;
  fromContentId: string;
  toContentId: string;
  relationType: string;
  createdAt: number;
}

export interface LegacyDiscussionSnapshot {
  discussionId: string;
  nodes: LegacyDiscussionNode[];
  relations: LegacyDiscussionRelation[];
}

export interface DiscussionBackfillReceipt {
  discussionId: string;
  manifestFingerprint: string;
  fingerprint: string;
  revision: 1;
  committedAt: number;
}

export interface PreparedDiscussionBackfill {
  manifest: DiscussionOwnershipManifest;
  manifestFingerprint: string;
  fingerprint: string;
  sourceFingerprint: string;
  snapshot: LegacyDiscussionSnapshot;
  subjectId: string | null;
  payloads: Array<{
    nodeId: string;
    reference: DiscussionPayloadReference | null;
  }>;
}

export interface LegacyDiscussionRepository {
  /** Consistent, bounded structural read; rejects any already-versioned node. */
  read(discussionId: string): Promise<LegacyDiscussionSnapshot>;
  receipt(discussionId: string): Promise<DiscussionBackfillReceipt | null>;
  /** Locks/revalidates source facts and atomically commits ownership, revision, receipt and outbox. */
  commit(
    prepared: PreparedDiscussionBackfill
  ): Promise<DiscussionBackfillReceipt>;
}

export interface LegacyDiscussionPayloads {
  read(nodeId: string): Promise<Buffer>;
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = (body: string | Buffer) =>
  createHash('sha256').update(body).digest('hex');
const ordered = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const timestamp = (value: number) => Number.isSafeInteger(value) && value >= 0;

function requireValid(value: boolean, message: string): asserts value {
  if (!value) throw new DiscussionValidationError(message);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function identity(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    [...value].every(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
    )
  );
}

export function parseDiscussionOwnershipManifest(
  value: unknown
): DiscussionOwnershipManifest {
  requireValid(
    record(value) &&
      exactKeys(value, ['version', 'discussionId', 'tenantId', 'owners']),
    'Invalid ownership manifest fields'
  );
  requireValid(
    value.version === 1 &&
      typeof value.discussionId === 'string' &&
      uuid.test(value.discussionId) &&
      identity(value.tenantId),
    'Invalid ownership manifest scope'
  );
  requireValid(
    Array.isArray(value.owners) &&
      value.owners.length > 0 &&
      value.owners.length <= DISCUSSION_MAX_NODES,
    'Invalid ownership manifest size'
  );
  const seen = new Set<string>();
  const owners = value.owners
    .map((owner: unknown) => {
      requireValid(
        record(owner) &&
          exactKeys(owner, ['nodeId', 'identityId']) &&
          typeof owner.nodeId === 'string' &&
          uuid.test(owner.nodeId) &&
          identity(owner.identityId),
        'Invalid owner assignment'
      );
      requireValid(!seen.has(owner.nodeId), 'Duplicate owner assignment');
      seen.add(owner.nodeId);
      return { nodeId: owner.nodeId, identityId: owner.identityId };
    })
    .sort((a, b) => ordered({ id: a.nodeId }, { id: b.nodeId }));
  return {
    version: 1,
    discussionId: value.discussionId,
    tenantId: value.tenantId,
    owners,
  };
}

export function legacyDiscussionFingerprint(
  snapshot: LegacyDiscussionSnapshot
): string {
  return hash(
    JSON.stringify({
      discussionId: snapshot.discussionId,
      nodes: snapshot.nodes
        .map((node) => ({
          id: node.id,
          referenceKey: node.referenceKey,
          kind: node.kind,
          state: node.state,
          visibility: node.visibility,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          deletedAt: node.deletedAt,
          likeCount: node.likeCount,
        }))
        .sort(ordered),
      relations: snapshot.relations
        .map((relation) => ({
          id: relation.id,
          fromContentId: relation.fromContentId,
          toContentId: relation.toContentId,
          relationType: relation.relationType,
          createdAt: relation.createdAt,
        }))
        .sort(ordered),
    })
  );
}

function validateGraph(
  snapshot: LegacyDiscussionSnapshot,
  manifest: DiscussionOwnershipManifest
): string | null {
  requireValid(
    snapshot.discussionId === manifest.discussionId,
    'Legacy snapshot belongs to another discussion'
  );
  requireValid(
    snapshot.nodes.length > 0 && snapshot.nodes.length <= DISCUSSION_MAX_NODES,
    'Invalid legacy discussion size'
  );
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  requireValid(nodes.size === snapshot.nodes.length, 'Duplicate legacy node');
  requireValid(
    nodes.size === manifest.owners.length &&
      manifest.owners.every((owner) => nodes.has(owner.nodeId)),
    'Ownership mapping must cover exactly every legacy node'
  );
  requireValid(
    nodes.get(snapshot.discussionId)?.kind === 'discussion',
    'Missing legacy discussion root'
  );
  const parents = new Map<string, string>();
  const relationIds = new Set<string>();
  let subjectId: string | null = null;
  requireValid(
    snapshot.relations.length <= DISCUSSION_MAX_NODES,
    'Too many legacy relations'
  );
  for (const relation of snapshot.relations) {
    requireValid(
      uuid.test(relation.id) &&
        !relationIds.has(relation.id) &&
        nodes.has(relation.fromContentId) &&
        uuid.test(relation.toContentId) &&
        timestamp(relation.createdAt),
      'Invalid legacy relation'
    );
    relationIds.add(relation.id);
    if (relation.relationType === 'replies') {
      requireValid(
        relation.fromContentId !== snapshot.discussionId &&
          !parents.has(relation.fromContentId) &&
          nodes.has(relation.toContentId),
        'Ambiguous or missing legacy parent'
      );
      parents.set(relation.fromContentId, relation.toContentId);
    } else {
      requireValid(
        relation.relationType === 'discusses' &&
          relation.fromContentId === snapshot.discussionId &&
          subjectId === null &&
          !nodes.has(relation.toContentId),
        'Invalid legacy subject relation'
      );
      subjectId = relation.toContentId;
    }
  }
  for (const node of nodes.values()) {
    requireValid(
      uuid.test(node.id) &&
        uuid.test(node.referenceKey) &&
        (node.id === snapshot.discussionId || node.kind === 'comment'),
      'Invalid legacy node identity or kind'
    );
    requireValid(
      ['draft', 'published', 'archived'].includes(node.state) &&
        ['public', 'unlisted', 'private'].includes(node.visibility),
      'Invalid legacy lifecycle'
    );
    requireValid(
      timestamp(node.createdAt) &&
        (node.updatedAt === null || timestamp(node.updatedAt)) &&
        (node.deletedAt === null || timestamp(node.deletedAt)) &&
        timestamp(node.likeCount),
      'Invalid legacy timestamp or likes'
    );
    const seen = new Set<string>();
    let current = node.id;
    while (current !== snapshot.discussionId) {
      requireValid(!seen.has(current), 'Cyclic legacy graph');
      requireValid(
        seen.size < DISCUSSION_MAX_DEPTH,
        'Legacy reply depth exceeds limit'
      );
      seen.add(current);
      const parent = parents.get(current);
      requireValid(!!parent, 'Missing legacy parent');
      current = parent;
    }
  }
  return subjectId;
}

interface BackfillPlan {
  manifest: DiscussionOwnershipManifest;
  manifestFingerprint: string;
  fingerprint: string;
  sourceFingerprint: string;
  snapshot: LegacyDiscussionSnapshot;
  subjectId: string | null;
  bodies: Array<{ nodeId: string; body: Buffer | null }>;
}

export class LegacyDiscussionBackfill {
  constructor(
    private readonly repository: LegacyDiscussionRepository,
    private readonly legacyPayloads: LegacyDiscussionPayloads,
    private readonly immutablePayloads: ImmutableDiscussionPayloads
  ) {}

  async plan(input: unknown): Promise<BackfillPlan> {
    const manifest = parseDiscussionOwnershipManifest(input);
    const manifestFingerprint = hash(JSON.stringify(manifest));
    const snapshot = await this.repository.read(manifest.discussionId);
    const subjectId = validateGraph(snapshot, manifest);
    const bodies: BackfillPlan['bodies'] = [];
    let totalBytes = 0;
    for (const node of [...snapshot.nodes].sort(ordered)) {
      let body: Buffer | null = null;
      if (node.deletedAt === null) {
        body = await this.legacyPayloads.read(node.id);
        requireValid(
          body.length > 0 && body.length <= DISCUSSION_MAX_PAYLOAD_BYTES,
          'Invalid legacy payload size'
        );
        totalBytes += body.length;
        requireValid(
          totalBytes <= DISCUSSION_MAX_GENERATION_BYTES,
          'Legacy payload total exceeds limit'
        );
        let payload: unknown;
        try {
          payload = JSON.parse(body.toString('utf8'));
        } catch {
          throw new DiscussionValidationError('Invalid legacy payload JSON');
        }
        requireValid(
          record(payload) &&
            Object.prototype.hasOwnProperty.call(payload, 'content'),
          'Missing legacy payload content'
        );
      }
      bodies.push({ nodeId: node.id, body });
    }
    const sourceFingerprint = legacyDiscussionFingerprint(snapshot);
    const fingerprint = hash(
      JSON.stringify({
        version: 1,
        manifestFingerprint,
        sourceFingerprint,
        payloads: bodies.map(({ nodeId, body }) => ({
          nodeId,
          sha256: body === null ? null : hash(body),
          bytes: body?.length ?? null,
        })),
      })
    );
    return {
      manifest,
      manifestFingerprint,
      fingerprint,
      sourceFingerprint,
      snapshot,
      subjectId,
      bodies,
    };
  }

  async apply(
    input: unknown,
    expectedFingerprint: string,
    legacyWritersStopped: boolean
  ): Promise<DiscussionBackfillReceipt> {
    requireValid(
      legacyWritersStopped === true,
      'Backfill requires a maintenance window with legacy writers stopped'
    );
    requireValid(
      /^[a-f0-9]{64}$/.test(expectedFingerprint),
      'Apply requires the reviewed plan fingerprint'
    );
    const manifest = parseDiscussionOwnershipManifest(input);
    const replay = await this.replay(manifest, expectedFingerprint);
    if (replay) return replay;
    try {
      return await this.applyPlan(manifest, expectedFingerprint);
    } catch (error) {
      // Another importer can commit between our initial receipt lookup and source read.
      const committed = await this.replay(manifest, expectedFingerprint);
      if (committed) return committed;
      throw error;
    }
  }

  private async replay(
    manifest: DiscussionOwnershipManifest,
    expectedFingerprint: string
  ): Promise<DiscussionBackfillReceipt | null> {
    const replay = await this.repository.receipt(manifest.discussionId);
    if (replay) {
      if (
        replay.fingerprint !== expectedFingerprint ||
        replay.manifestFingerprint !== hash(JSON.stringify(manifest))
      )
        throw new DiscussionConflictError(
          'Discussion was backfilled with another plan'
        );
      return replay;
    }
    return null;
  }

  private async applyPlan(
    manifest: DiscussionOwnershipManifest,
    expectedFingerprint: string
  ): Promise<DiscussionBackfillReceipt> {
    const plan = await this.plan(manifest);
    if (plan.fingerprint !== expectedFingerprint)
      throw new DiscussionConflictError(
        'Legacy source or ownership changed; review a new plan'
      );
    const payloads: PreparedDiscussionBackfill['payloads'] = [];
    for (const { nodeId, body } of plan.bodies) {
      const owner = manifest.owners.find((entry) => entry.nodeId === nodeId);
      if (!owner) throw new DiscussionValidationError('Missing verified owner');
      const reference =
        body === null
          ? null
          : await this.immutablePayloads.put(nodeId, body, {
              tenantId: manifest.tenantId,
              ownerIdentityId: owner.identityId,
              actorIdentityId: null,
            });
      if (
        body &&
        (!reference ||
          reference.bytes !== body.length ||
          reference.sha256 !== hash(body))
      )
        throw new Error(
          'Immutable payload adapter returned inconsistent metadata'
        );
      payloads.push({ nodeId, reference });
    }
    // Detect drift during copying. This cannot replace stopping legacy object writers.
    for (const { nodeId, body } of plan.bodies) {
      if (body && hash(await this.legacyPayloads.read(nodeId)) !== hash(body))
        throw new DiscussionConflictError(
          'Legacy payload changed during backfill'
        );
    }
    return this.repository.commit({
      manifest: plan.manifest,
      manifestFingerprint: plan.manifestFingerprint,
      fingerprint: plan.fingerprint,
      sourceFingerprint: plan.sourceFingerprint,
      snapshot: plan.snapshot,
      subjectId: plan.subjectId,
      payloads,
    });
  }
}
