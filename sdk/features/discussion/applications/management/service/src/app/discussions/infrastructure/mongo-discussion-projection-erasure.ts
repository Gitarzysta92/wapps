import type { Collection, Document } from 'mongodb';
import {
  DISCUSSION_PROJECTION_SCHEMA,
  type DiscussionGenerationNode,
} from '@apps/shared';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import type {
  DiscussionProjectionErasureStore,
  DiscussionProjectionErasureTarget,
} from '../application/erase-discussion-projections';
import { anonymousDiscussionPayload } from '../application/discussion-anonymity';

const durable = { w: 'majority', j: true } as const;
const confirmed = {
  readConcern: { level: 'majority' },
  readPreference: 'primary',
} as const;
const batch = 100;
type Stored = Document & { _id: string };
export type StoredDiscussionGeneration = Omit<
  DiscussionGenerationNode,
  'schemaVersion'
> & { schemaVersion: number };

export class MongoDiscussionProjectionErasure
  implements DiscussionProjectionErasureStore
{
  constructor(
    private readonly nodes: Collection<StoredDiscussionGeneration>,
    private readonly legacyNodes: Collection<Stored>
  ) {}

  async ensureIndexes(): Promise<void> {
    await this.nodes.createIndex({ id: 1, _id: 1 });
    await this.nodes.createIndex({ schemaVersion: 1, _id: 1 });
    await this.nodes.createIndex({ ownerIdentityId: 1, _id: 1 });
  }

  async purge(target: DiscussionProjectionErasureTarget): Promise<boolean> {
    if (!(await this.current(target))) return false;
    const obsolete = { id: target.nodeId, _id: { $ne: target.nodeId } };
    const rows = await this.nodes
      .find(obsolete, {
        ...confirmed,
        projection: { _id: 1, discussionId: 1, schemaVersion: 1 },
      })
      .sort({ _id: 1 })
      .limit(batch)
      .toArray();
    for (const row of rows)
      if (row.discussionId !== target.discussionId || row.schemaVersion !== 2)
        throw new Error('Unrecognized historical Discussion projection');
    if (rows.length)
      await this.nodes.deleteMany(
        {
          ...obsolete,
          _id: { $in: rows.map((row) => row._id) },
          schemaVersion: 2,
        },
        { writeConcern: durable }
      );
    await this.legacyNodes.deleteOne(
      { _id: target.nodeId },
      { writeConcern: durable }
    );
    if (
      await this.nodes.findOne(obsolete, {
        ...confirmed,
        projection: { _id: 1 },
      })
    )
      return false;
    if (!(await this.current(target)))
      throw new Error('Stable Discussion erasure guard disappeared');
    return true;
  }

  async purgeLegacyBatch(): Promise<boolean> {
    // The v1 cache has no authoritative ownership. Its entire obsolete collection must drain,
    // including orphans, before any erasure can claim those bytes are gone.
    const legacy = await this.legacyNodes
      .find({}, { ...confirmed, projection: { _id: 1 } })
      .sort({ _id: 1 })
      .limit(batch)
      .toArray();
    if (legacy.length) {
      await this.legacyNodes.deleteMany(
        { _id: { $in: legacy.map((row) => row._id) } },
        { writeConcern: durable }
      );
      return true;
    }
    const older = await this.nodes
      .find(
        { schemaVersion: { $ne: DISCUSSION_PROJECTION_SCHEMA } },
        { ...confirmed, projection: { _id: 1, schemaVersion: 1 } }
      )
      .sort({ schemaVersion: 1, _id: 1 })
      .limit(batch)
      .toArray();
    if (older.some((row) => row.schemaVersion !== 2))
      throw new Error(
        'Unrecognized Discussion projection schema requires investigation'
      );
    if (older.length) {
      await this.nodes.deleteMany(
        { _id: { $in: older.map((row) => row._id) }, schemaVersion: 2 },
        { writeConcern: durable }
      );
      return true;
    }
    return false;
  }

  async assertNoAttribution(identityId: string): Promise<void> {
    if (!isCanonicalIdentityId(identityId))
      throw new Error('Invalid Discussion erasure identity');
    if (
      await this.nodes.findOne(
        { ownerIdentityId: identityId },
        { ...confirmed, projection: { _id: 1 } }
      )
    )
      throw new Error('Unaccounted Discussion projection attribution remains');
  }

  private async current(
    target: DiscussionProjectionErasureTarget
  ): Promise<boolean> {
    const node = await this.nodes.findOne({ _id: target.nodeId }, confirmed);
    if (!node || node.revision < target.revision) return false;
    if (
      node.id !== target.nodeId ||
      node.discussionId !== target.discussionId ||
      node.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA ||
      !Number.isSafeInteger(node.revision) ||
      node.ownerIdentityId !== null
    )
      throw new Error('Invalid anonymous Discussion projection guard');
    if (
      node.payload !== null &&
      JSON.stringify(anonymousDiscussionPayload(node.payload)) !==
        JSON.stringify(node.payload)
    )
      throw new Error(
        'Discussion projection still contains structured attribution'
      );
    if (node.deletedAt !== null && node.payload !== null)
      throw new Error('Discussion tombstone still contains payload bytes');
    return true;
  }
}
