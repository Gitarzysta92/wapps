import { PlatformMongoClient } from '@sdk/extras/mongo';
import {
  DISCUSSION_MAX_NODES,
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import { DiscussionProjectionReader } from '../application/discussion-queries';

export class MongoDiscussionProjections implements DiscussionProjectionReader {
  constructor(private readonly mongo: PlatformMongoClient) {}
  heads(tenantId: string) {
    return this.mongo
      .collection<DiscussionGenerationHead>('discussion_generation_heads')
      .find({ tenantId, bindingKey: { $exists: false } })
      .sort({ lastActivityAt: -1, _id: 1 })
      .limit(50)
      .toArray();
  }
  head(id: string) {
    return this.mongo
      .collection<DiscussionGenerationHead>('discussion_generation_heads')
      .findOne({ _id: id });
  }
  nodes(generation: string, rootId?: string) {
    return this.mongo
      .collection<DiscussionGenerationNode>('discussion_generation_nodes')
      .find({ generation, ...(rootId ? { id: rootId } : {}) })
      .sort({ depth: 1, createdAt: 1, id: 1 })
      .limit(DISCUSSION_MAX_NODES + 1)
      .toArray();
  }
}
