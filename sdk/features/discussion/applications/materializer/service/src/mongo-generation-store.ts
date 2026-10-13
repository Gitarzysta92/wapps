import type { Collection } from 'mongodb';
import {
  DISCUSSION_PROJECTION_SCHEMA,
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import {
  DiscussionGenerationStore,
  InvalidSnapshotError,
} from './materialization';

const durable = { w: 'majority', j: true } as const;

export class MongoGenerationStore implements DiscussionGenerationStore {
  constructor(
    private readonly nodes: Collection<DiscussionGenerationNode>,
    private readonly heads: Collection<DiscussionGenerationHead>
  ) {}

  async ensureIndexes(): Promise<void> {
    await this.nodes.createIndex({
      generation: 1,
      depth: 1,
      createdAt: 1,
      id: 1,
    });
    await this.heads.createIndex({ tenantId: 1, lastActivityAt: -1, _id: 1 });
  }

  async writeNodes(nodes: DiscussionGenerationNode[]): Promise<void> {
    if (!nodes.length) return;
    if (
      nodes.length > 100 ||
      nodes.some(
        (node) =>
          node._id !== node.id ||
          node.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA
      ) ||
      new Set(nodes.map((node) => node.id)).size !== nodes.length
    )
      throw new InvalidSnapshotError(
        'Invalid stable discussion projection identity'
      );
    await this.nodes.bulkWrite(
      nodes.map((node) => ({
        updateOne: {
          filter: { _id: node._id },
          // Atomic per-node replacement prevents a paused old snapshot from restoring erased bytes.
          update: [
            {
              $replaceWith: {
                $cond: [
                  {
                    $or: [
                      { $eq: [{ $type: '$revision' }, 'missing'] },
                      {
                        $and: [
                          {
                            $eq: [
                              '$discussionId',
                              { $literal: node.discussionId },
                            ],
                          },
                          { $lt: ['$revision', node.revision] },
                        ],
                      },
                    ],
                  },
                  { $literal: node },
                  '$$ROOT',
                ],
              },
            },
          ],
          upsert: true,
        },
      })),
      { ordered: true, writeConcern: durable }
    );
    const current = await this.nodes
      .find({ _id: { $in: nodes.map((node) => node.id) } })
      .limit(nodes.length)
      .toArray();
    const byId = new Map(current.map((node) => [node.id, node]));
    for (const node of nodes) {
      const stored = byId.get(node.id);
      if (
        !stored ||
        stored._id !== stored.id ||
        stored.discussionId !== node.discussionId ||
        stored.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA ||
        !Number.isSafeInteger(stored.revision) ||
        stored.revision < node.revision ||
        (stored.revision === node.revision &&
          stored.generation !== node.generation)
      )
        throw new InvalidSnapshotError(
          'Conflicting discussion projection node'
        );
    }
  }

  async publish(
    head: DiscussionGenerationHead
  ): Promise<'published' | 'superseded' | 'unchanged'> {
    if (head.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA)
      throw new InvalidSnapshotError(
        'Unsupported discussion projection schema'
      );
    const updated = await this.heads.updateOne(
      {
        _id: head._id,
        $or: [
          { revision: { $lt: head.revision } },
          {
            revision: head.revision,
            schemaVersion: { $lt: head.schemaVersion },
          },
        ],
      },
      { $set: head },
      { writeConcern: durable }
    );
    if (updated.matchedCount === 1) return 'published';
    try {
      await this.heads.insertOne(head, { writeConcern: durable });
      return 'published';
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 11000
      )
        throw error;
    }
    const current = await this.heads.findOne({ _id: head._id });
    if (!current)
      throw new Error('Projection head disappeared during publication');
    if (current.revision > head.revision) return 'superseded';
    if (current.revision === head.revision) {
      if (current.fingerprint !== head.fingerprint)
        throw new InvalidSnapshotError(
          'Conflicting snapshots at the same revision'
        );
      return 'unchanged';
    }
    // A competing first insert installed an older revision between update/insert.
    return this.publish(head);
  }
}
