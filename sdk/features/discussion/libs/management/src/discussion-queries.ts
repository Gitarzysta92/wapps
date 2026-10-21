import { DISCUSSION_PROJECTION_SCHEMA } from '@sdk/features/discussion/core';
import type {
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@sdk/features/discussion/core';
import { canReadDiscussion } from './discussion-access';
import {
  assertDiscussionBinding,
  type DiscussionBindingAccess,
} from './discussion-bindings.port';
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
    private readonly bindings?: DiscussionBindingAccess
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
        head.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA ||
        root.bindingKey ||
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
    bindingKey?: string,
    rootOnly = false
  ) {
    const root = await this.writes.resource(id);
    if (!root || root.kind !== 'discussion' || !this.visible(root, actor))
      throw new DiscussionNotFoundError('Discussion not found');
    await assertDiscussionBinding(
      root.bindingKey,
      bindingKey,
      actor?.tenantId ?? this.publicTenant,
      this.bindings
    );
    const head = await this.projections.head(id);
    if (
      !head ||
      head.schemaVersion !== DISCUSSION_PROJECTION_SCHEMA ||
      head.revision !== root.revision ||
      head._id !== id ||
      head.tenantId !== root.tenantId ||
      (head.bindingKey ?? null) !== (bindingKey ?? null)
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
    await assertDiscussionBinding(
      currentRoot.bindingKey,
      bindingKey,
      actor?.tenantId ?? this.publicTenant,
      this.bindings
    );
    resources = await this.writes.resources(id);
    currentRoot = resources.find((resource) => resource.id === id);
    if (!currentRoot || !this.visible(currentRoot, actor))
      throw new DiscussionNotFoundError('Discussion not found');
    if (
      currentRoot.revision !== head.revision ||
      (currentRoot.bindingKey ?? null) !== (bindingKey ?? null) ||
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
              payload: this.bindings
                ? this.bindings.anonymous(
                    authority.get(node.id)?.bindingKey ?? undefined,
                    node.payload
                  )
                : { content: null },
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
