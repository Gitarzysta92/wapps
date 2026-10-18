import type {
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import {
  DiscussionProjectionReader,
  DiscussionQueries,
} from './discussion-queries';
import {
  DiscussionResource,
  DiscussionWriteRepository,
} from './discussion-write.port';

function fixture() {
  const root: DiscussionResource = {
    id: 'root',
    discussionId: 'root',
    revision: 2,
    tenantId: 'default',
    ownerIdentityId: 'owner',
    rootOwnerIdentityId: 'owner',
    kind: 'discussion',
    state: 'published',
    visibility: 'public',
    rootState: 'published',
    rootVisibility: 'public',
    deletedAt: null,
    rootDeletedAt: null,
  };
  const reply: DiscussionResource = {
    ...root,
    id: 'reply',
    kind: 'comment',
    ownerIdentityId: 'other',
  };
  const head: DiscussionGenerationHead = {
    _id: 'root',
    schemaVersion: 4,
    tenantId: 'default',
    revision: 2,
    generation: 'pinned',
    fingerprint: 'hash',
    subjectId: null,
    subjectReferenceKey: null,
    visibility: 'public',
    state: 'published',
    deletedAt: null,
    createdAt: 1,
    lastActivityAt: 2,
    descendantsCount: 1,
    nodeCount: 2,
  };
  const node: DiscussionGenerationNode = {
    _id: 'pinned:root',
    id: 'root',
    referenceKey: 'root',
    schemaVersion: 4,
    discussionId: 'root',
    generation: 'pinned',
    revision: 2,
    depth: 0,
    kind: 'discussion',
    parentId: null,
    ownerIdentityId: 'owner',
    state: 'published',
    visibility: 'public',
    createdAt: 1,
    updatedAt: null,
    deletedAt: null,
    likeCount: 0,
    payload: { content: 'root body' },
  };
  const writes: jest.Mocked<DiscussionWriteRepository> = {
    resource: jest.fn().mockResolvedValue(root),
    resources: jest.fn().mockResolvedValue([root, reply]),
    receipt: jest.fn(),
    commit: jest.fn(),
  };
  const projections: jest.Mocked<DiscussionProjectionReader> = {
    heads: jest.fn().mockResolvedValue([head]),
    head: jest.fn().mockResolvedValue(head),
    nodes: jest.fn().mockResolvedValue([
      node,
      {
        ...node,
        _id: 'pinned:reply',
        id: 'reply',
        kind: 'comment',
        parentId: 'root',
        depth: 1,
        payload: { content: 'secret reply' },
      },
    ]),
  };
  return {
    root,
    reply,
    head,
    writes,
    projections,
    queries: new DiscussionQueries(writes, projections, 'default'),
  };
}

describe('current authority over pinned discussion projections', () => {
  it('removes attribution from an anonymous canonical contribution even when a same-revision projection retains old metadata', async () => {
    const { queries, root, reply, writes, projections } = fixture();
    writes.resources.mockResolvedValue([
      { ...root, ownerIdentityId: null, rootOwnerIdentityId: null },
      reply,
    ]);
    const nodes = await projections.nodes('pinned');
    nodes[0].payload = {
      content: { displayName: 'Private name', text: 'Retained text' },
      ownerIdentityId: 'Private identity',
    };
    projections.nodes.mockResolvedValue(nodes);
    const result = await queries.findOne('root', null);
    expect(result.nodes[0]).toMatchObject({
      ownerIdentityId: null,
      payload: { content: { text: 'Retained text' } },
    });
    expect(JSON.stringify(result)).not.toContain('Private');
  });

  it('rechecks canonical authority after target eligibility awaits', async () => {
    const { root, reply, head, writes, projections } = fixture();
    const target = {
      kind: 'article' as const,
      id: '40e90383-a22e-4b5f-83c3-a7ef97f2e730',
    };
    root.target = target;
    head.subjectId = target.id;
    head.bindingKey = `${target.kind}:${target.id}`;
    const targets = { visible: jest.fn().mockResolvedValue(true) };
    const queries = new DiscussionQueries(
      writes,
      projections,
      'default',
      targets
    );
    writes.resources.mockResolvedValueOnce([root, reply]).mockResolvedValue([
      { ...root, ownerIdentityId: null, revision: 3 },
      { ...reply, revision: 3 },
    ]);
    await expect(queries.findOne('root', null, target)).rejects.toThrow(
      'changed while reading'
    );
    expect(targets.visible).toHaveBeenCalledTimes(2);
  });

  it('pins all loaded nodes to one published generation', async () => {
    const { queries, projections } = fixture();
    const result = await queries.findOne('root', null);
    expect(projections.nodes).toHaveBeenCalledWith('pinned');
    expect(result.nodes).toHaveLength(2);
  });

  it.each([
    { rootVisibility: 'private' as const },
    { rootDeletedAt: 5 },
    { tenantId: 'other' },
  ])(
    'hides content when current authority restricts it during projection I/O: %j',
    async (changed) => {
      const { queries, root, writes } = fixture();
      writes.resources.mockResolvedValue([{ ...root, ...changed }]);
      await expect(queries.findOne('root', null)).rejects.toThrow('not found');
    }
  );

  it('fails as pending when a newer committed revision has not materialized', async () => {
    const { queries, root, writes } = fixture();
    writes.resource.mockResolvedValue({ ...root, revision: 3 });
    await expect(queries.findOne('root', null)).rejects.toThrow('pending');
  });

  it('fails as pending if an update commits while a pinned generation is loading', async () => {
    const { queries, root, reply, writes } = fixture();
    writes.resources.mockResolvedValue([
      { ...root, revision: 3 },
      { ...reply, revision: 3 },
    ]);
    await expect(queries.findOne('root', null)).rejects.toThrow(
      'changed while reading'
    );
  });

  it('does not expose a private reply body or count it as a permitted reply', async () => {
    const { queries, root, reply, writes } = fixture();
    writes.resources.mockResolvedValue([
      root,
      { ...reply, visibility: 'private' },
    ]);
    const result = await queries.findOne('root', null);
    expect(JSON.stringify(result)).not.toContain('secret reply');
    expect(result.nodes[1]).toMatchObject({
      id: 'reply',
      payload: null,
      redacted: true,
    });
    expect(result.aggregate.descendantsCount).toBe(0);
  });

  it('keeps unlisted and newly private/deleted discussions out of public listing', async () => {
    const { queries, root, writes } = fixture();
    for (const changed of [
      { visibility: 'unlisted' as const },
      { rootDeletedAt: 10 },
      { rootVisibility: 'private' as const },
    ]) {
      writes.resources.mockResolvedValue([{ ...root, ...changed }]);
      expect(await queries.findAll(null)).toEqual([]);
    }
  });
});
