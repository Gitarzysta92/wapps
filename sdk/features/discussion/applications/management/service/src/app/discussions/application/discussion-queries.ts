import type {
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import { canReadDiscussion } from './discussion-access';
import { presentAnonymousDiscussionPayload } from './discussion-anonymity';
import type { DiscussionTarget } from '@sdk/features/discussion/core';
import {
  assertDiscussionTarget,
  type DiscussionTargets,
} from './discussion-targets.port';
import {
  DiscussionActor,
  DiscussionNotFoundError,
  DiscussionWriteRepository,
} from './discussion-write.port';

export class DiscussionProjectionPendingError extends Error {}

export interface DiscussionProjectionReader {
  heads(tenantId: string): Promise<DiscussionGenerationHead[]>;
  head(id: string): Promise<DiscussionGenerationHead | null>;
  nodes(
    generation: string,
    rootId?: string
  ): Promise<DiscussionGenerationNode[]>;
}

export class DiscussionQueries {
  constructor(
    private readonly writes: DiscussionWriteRepository,
    private readonly projections: DiscussionProjectionReader,
    private readonly publicTenant: string,
    private readonly targets?: DiscussionTargets
  ) {}

  async findAll(actor: DiscussionActor | null) {
    const heads = await this.projections.heads(
      actor?.tenantId ?? this.publicTenant
    );
    const visible: DiscussionGenerationHead[] = [];
    for (const head of heads) {
      const resources = await this.writes.resources(head._id);
      const root = resources.find((resource) => resource.id === head._id);
      if (
        !root ||
        root.target ||
        root.visibility === 'unlisted' ||
        root.revision !== head.revision ||
        !this.visible(root, actor)
      )
        continue;
      const descendantsCount = resources.filter(
        (resource) =>
          resource.kind === 'comment' && this.visible(resource, actor)
      ).length;
      visible.push({ ...head, descendantsCount });
    }
    return visible;
  }

  async findOne(
    id: string,
    actor: DiscussionActor | null,
    target?: DiscussionTarget,
    rootOnly = false
  ) {
    const root = await this.writes.resource(id);
    if (!root || root.kind !== 'discussion' || !this.visible(root, actor))
      throw new DiscussionNotFoundError('Discussion not found');
    await assertDiscussionTarget(
      root.target,
      target,
      actor?.tenantId ?? this.publicTenant,
      this.targets
    );
    const head = await this.projections.head(id);
    if (
      !head ||
      head.revision !== root.revision ||
      head._id !== id ||
      head.tenantId !== root.tenantId ||
      (target &&
        (head.subjectId !== target.id || head.subjectKind !== target.kind))
    )
      throw new DiscussionProjectionPendingError(
        'Discussion projection is pending'
      );
    const nodes = rootOnly
      ? await this.projections.nodes(head.generation, id)
      : await this.projections.nodes(head.generation);
    // Recheck current authority after loading the pinned projection, including privacy changes during I/O.
    let resources = await this.writes.resources(id);
    let currentRoot = resources.find((resource) => resource.id === id);
    if (!currentRoot || !this.visible(currentRoot, actor))
      throw new DiscussionNotFoundError('Discussion not found');
    await assertDiscussionTarget(
      currentRoot.target,
      target,
      actor?.tenantId ?? this.publicTenant,
      this.targets
    );
    resources = await this.writes.resources(id);
    currentRoot = resources.find((resource) => resource.id === id);
    if (!currentRoot || !this.visible(currentRoot, actor))
      throw new DiscussionNotFoundError('Discussion not found');
    if (
      currentRoot.revision !== head.revision ||
      resources.some((resource) => resource.revision !== head.revision) ||
      resources.length !== head.nodeCount ||
      nodes.length !== (rootOnly ? 1 : head.nodeCount) ||
      (rootOnly && nodes[0]?.id !== id)
    )
      throw new DiscussionProjectionPendingError(
        'Discussion changed while reading'
      );
    const authority = new Map(
      resources.map((resource) => [resource.id, resource])
    );
    const permitted = nodes.filter((node) => {
      const resource = authority.get(node.id);
      return !!resource && this.visible(resource, actor);
    });
    const permittedIds = new Set(permitted.map((node) => node.id));
    // Retain only structural placeholders for inaccessible/deleted parents.
    const result = nodes.map((node) =>
      permittedIds.has(node.id)
        ? authority.get(node.id)?.ownerIdentityId === null
          ? {
              ...node,
              ownerIdentityId: null,
              payload: presentAnonymousDiscussionPayload(
                node.payload,
                authority.get(node.id)?.target
              ),
            }
          : node
        : {
            id: node.id,
            parentId: node.parentId,
            depth: node.depth,
            kind: node.kind,
            payload: null,
            redacted: true,
          }
    );
    return {
      aggregate: {
        ...head,
        descendantsCount: resources.filter(
          (node) => node.kind === 'comment' && this.visible(node, actor)
        ).length,
      },
      nodes: result,
    };
  }

  private visible(
    resource: Parameters<typeof canReadDiscussion>[0],
    actor: DiscussionActor | null
  ) {
    return (
      resource.tenantId === (actor?.tenantId ?? this.publicTenant) &&
      canReadDiscussion(resource, actor)
    );
  }
}
