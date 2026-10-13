import type { Collection } from 'mongodb';
import type {
  EditorialProjection,
  EditorialProjectionKind,
} from '@apps/shared';
import {
  assertEditorialSnapshot,
  EditorialProjectionStore,
  EditorialPublicationOutcome,
  editorialProjectionId,
  inspectEditorialProjection,
} from '../application/editorial-materialization';

const durable = { w: 'majority', j: true } as const;
export const EDITORIAL_PROJECTION_COLLECTION = 'editorial_projections_v1';

export class MongoEditorialProjections implements EditorialProjectionStore {
  constructor(private readonly collection: Collection<EditorialProjection>) {}

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({
      tenantId: 1,
      kind: 1,
      deletedAt: 1,
      'content.slug': 1,
    });
  }

  find(
    kind: EditorialProjectionKind,
    resourceId: string
  ): Promise<unknown | null> {
    return this.collection.findOne(
      { _id: editorialProjectionId(kind, resourceId) },
      {
        readConcern: { level: 'majority' },
        readPreference: 'primary',
        maxTimeMS: 3000,
      }
    );
  }

  async publish(
    input: EditorialProjection
  ): Promise<EditorialPublicationOutcome> {
    const projection = inspectEditorialProjection(input);
    for (let attempt = 0; attempt < 4; attempt++) {
      const previous = await this.find(projection.kind, projection.resourceId);
      if (previous === null) {
        try {
          await this.collection.insertOne(projection, {
            writeConcern: durable,
          });
          return 'published';
        } catch (error) {
          if (
            !error ||
            typeof error !== 'object' ||
            !('code' in error) ||
            error.code !== 11000
          )
            throw error;
          continue;
        }
      }
      const current = inspectEditorialProjection(previous);
      assertEditorialSnapshot(
        current._id === projection._id,
        'Projection identity mismatch'
      );
      if (current.revision > projection.revision) return 'superseded';
      if (current.revision === projection.revision) {
        assertEditorialSnapshot(
          current.fingerprint === projection.fingerprint,
          'Conflicting authoritative snapshots at one revision'
        );
        return 'unchanged';
      }
      const updated = await this.collection.replaceOne(
        {
          _id: projection._id,
          revision: current.revision,
          fingerprint: current.fingerprint,
        },
        projection,
        { writeConcern: durable }
      );
      if (updated.matchedCount === 1) return 'published';
    }
    throw new Error(
      'Concurrent Editorial projection publication; retry from authoritative state'
    );
  }
}
