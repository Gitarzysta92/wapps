import type { Collection } from 'mongodb';
import {
  DISCUSSION_MAX_DEPTH,
  DISCUSSION_MAX_NODES,
  DISCUSSION_PROJECTION_SCHEMA,
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import {
  DiscussionProjectionAuthority,
  DiscussionProjectionCondition,
  DiscussionProjectionInspector,
} from './reconciliation';

export class MongoGenerationInspector implements DiscussionProjectionInspector {
  constructor(
    private readonly nodes: Pick<Collection<DiscussionGenerationNode>, 'find'>,
    private readonly heads: Pick<
      Collection<DiscussionGenerationHead>,
      'findOne'
    >
  ) {}

  async inspect(
    authority: DiscussionProjectionAuthority
  ): Promise<DiscussionProjectionCondition> {
    const head = await this.heads.findOne({ _id: authority.id });
    if (!head) return 'missing';
    if (!Number.isSafeInteger(head.revision) || head.revision < 1)
      return 'conflict';
    if (head.revision > authority.revision) return 'ahead';
    if (head.revision < authority.revision) return 'stale';
    if (
      Number.isInteger(head.schemaVersion) &&
      Number(head.schemaVersion) >= 2 &&
      Number(head.schemaVersion) < DISCUSSION_PROJECTION_SCHEMA
    )
      return 'stale';
    if (
      head.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA ||
      head.tenantId !== authority.tenantId ||
      !/^[a-f0-9]{64}$/.test(head.fingerprint) ||
      head.generation !==
        `${authority.id}:${head.revision}:${head.fingerprint}` ||
      head.nodeCount !== authority.nodeCount ||
      head.nodeCount < 1 ||
      head.nodeCount > DISCUSSION_MAX_NODES
    )
      return 'conflict';
    const nodes = await this.nodes
      .find(
        { generation: head.generation },
        {
          projection: {
            _id: 1,
            id: 1,
            generation: 1,
            revision: 1,
            schemaVersion: 1,
            discussionId: 1,
            parentId: 1,
            kind: 1,
            depth: 1,
          },
        }
      )
      .limit(DISCUSSION_MAX_NODES + 1)
      .toArray();
    if (nodes.length > head.nodeCount) return 'conflict';
    const ids = new Set<string>();
    for (const node of nodes) {
      if (
        !node.id ||
        ids.has(node.id) ||
        node._id !== node.id ||
        node.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA ||
        node.revision !== head.revision ||
        node.discussionId !== authority.id
      )
        return 'conflict';
      ids.add(node.id);
    }
    if (nodes.length < head.nodeCount) return 'incomplete';
    const root = nodes.find((node) => node.id === authority.id);
    if (
      !root ||
      root.kind !== 'discussion' ||
      root.parentId !== null ||
      root.depth !== 0
    )
      return 'conflict';
    const byId = new Map(nodes.map((node) => [node.id, node]));
    for (const node of nodes) {
      if (node.id === authority.id) continue;
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (
        !parent ||
        node.kind !== 'comment' ||
        !Number.isSafeInteger(node.depth) ||
        node.depth < 1 ||
        node.depth > DISCUSSION_MAX_DEPTH ||
        node.depth !== parent.depth + 1
      )
        return 'conflict';
    }
    return 'current';
  }
}
