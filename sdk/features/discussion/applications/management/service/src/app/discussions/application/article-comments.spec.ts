import { ok } from '@sdk/kernel/standard';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import type { DiscussionTarget } from '@sdk/features/discussion/core';
import type {
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import {
  ArticleComments,
  type ArticleCommentThreads,
} from './article-comments';
import { ApplicationDiscussions } from './application-discussions';
import { DurableDiscussionCommands } from './durable-discussion-commands';
import {
  DiscussionQueries,
  type DiscussionProjectionReader,
} from './discussion-queries';
import type { DiscussionTargets } from './discussion-targets.port';
import type {
  DiscussionActor,
  DiscussionResource,
  DiscussionWriteRepository,
  ImmutableDiscussionPayloads,
} from './discussion-write.port';

const articleId = 'f56428fb-9bc2-4c34-814a-3c558ec92391';
const rootId = 'ecbd2483-0523-4160-8989-b4f0f126782e';
const childId = '7d8e649a-8c2f-4c27-95de-2d4eb128bda3';
const target: DiscussionTarget = { kind: 'article', id: articleId };
const actor: DiscussionActor = {
  identityId: 'private-owner-identity',
  tenantId: 'default',
  roles: [],
};
const content = { displayName: 'Public reader', text: 'A thoughtful comment.' };

function fixture(kind: DiscussionTarget['kind'] = 'article') {
  const target: DiscussionTarget = { kind, id: articleId };
  const root: DiscussionResource = {
    pinned: false,
    id: rootId,
    discussionId: rootId,
    target,
    revision: 2,
    tenantId: 'default',
    ownerIdentityId: actor.identityId,
    rootOwnerIdentityId: actor.identityId,
    kind: 'discussion',
    state: 'published',
    visibility: 'public',
    rootState: 'published',
    rootVisibility: 'public',
    deletedAt: null,
    rootDeletedAt: null,
  };
  const child: DiscussionResource = {
    ...root,
    id: childId,
    kind: 'comment',
    ownerIdentityId: 'other-private-identity',
  };
  const writes: jest.Mocked<DiscussionWriteRepository> = {
    resource: jest.fn().mockResolvedValue(root),
    resources: jest.fn().mockResolvedValue([root, child]),
    receipt: jest.fn().mockResolvedValue(null),
    commit: jest.fn().mockResolvedValue({
      id: rootId,
      discussionId: rootId,
      revision: 3,
      projection: 'pending',
    }),
  };
  const payloads: jest.Mocked<ImmutableDiscussionPayloads> = {
    put: jest
      .fn()
      .mockResolvedValue({ key: 'version', sha256: 'hash', bytes: 20 }),
  };
  const policy: jest.Mocked<IPolicyEvaluator> = {
    evaluate: jest.fn().mockResolvedValue(ok(true)),
  };
  const targets: jest.Mocked<DiscussionTargets> = {
    visible: jest.fn().mockResolvedValue(true),
  };
  const commands = new DurableDiscussionCommands(
    writes,
    payloads,
    policy,
    { generate: () => rootId },
    targets
  );
  const head: DiscussionGenerationHead = {
    _id: rootId,
    schemaVersion: 3,
    tenantId: 'default',
    generation: 'g2',
    fingerprint: 'hash',
    revision: 2,
    subjectId: articleId,
    subjectKind: kind,
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
    _id: 'g2:root',
    schemaVersion: 3,
    id: rootId,
    referenceKey: rootId,
    discussionId: rootId,
    generation: 'g2',
    revision: 2,
    depth: 0,
    kind: 'discussion',
    parentId: null,
    ownerIdentityId: actor.identityId,
    state: 'published',
    visibility: 'public',
    createdAt: 1,
    updatedAt: null,
    deletedAt: null,
    likeCount: 0,
    payload: {
      content:
        kind === 'application'
          ? { ...content, title: 'A public topic', tags: ['privacy'] }
          : content,
    },
  };
  const projections: jest.Mocked<DiscussionProjectionReader> = {
    heads: jest.fn().mockResolvedValue([head]),
    head: jest.fn().mockResolvedValue(head),
    nodes: jest.fn().mockImplementation(async (_generation, rootOnly) =>
      rootOnly
        ? [node]
        : [
            node,
            {
              ...node,
              _id: 'g2:child',
              id: childId,
              kind: 'comment',
              parentId: rootId,
              depth: 1,
              ownerIdentityId: child.ownerIdentityId,
              payload: { content: { ...content, text: 'A reply' } },
            },
          ]
    ),
  };
  const queries = new DiscussionQueries(
    writes,
    projections,
    'default',
    targets
  );
  const threads: jest.Mocked<ArticleCommentThreads> = {
    list: jest.fn().mockResolvedValue([
      {
        id: rootId,
        at: 1,
        ...(kind === 'application' ? { pinned: false } : {}),
      },
    ]),
  };
  const votes = {
    read: jest
      .fn()
      .mockResolvedValue(
        new Map(
          [root, child].map((node) => [
            node.id,
            { upvotes: 0, downvotes: 0, mine: 0 },
          ])
        )
      ),
  };
  return {
    votes,
    root,
    child,
    writes,
    payloads,
    policy,
    targets,
    commands,
    projections,
    queries,
    threads,
    comments: new ArticleComments(
      commands,
      queries,
      writes,
      threads,
      targets,
      'default'
    ),
    applications: new ApplicationDiscussions(
      commands,
      queries,
      writes,
      threads,
      targets,
      'default',
      votes
    ),
  };
}

describe('article comments application boundary', () => {
  it.each(['article', 'application'] as const)(
    'retains public mention references in %s roots, replies and listings',
    async (kind) => {
      const f = fixture(kind);
      const nodes = f.projections.nodes.getMockImplementation();
      if (!nodes) throw new Error('Missing projection fixture');
      const mentions = ['00000000-0000-4000-8000-000000000001'];
      f.projections.nodes.mockImplementation(async (...args) =>
        (await nodes(...args)).map((node) => ({
          ...node,
          payload: {
            content: {
              ...content,
              ...(kind === 'application' && node.depth === 0
                ? { title: 'A public topic', tags: ['privacy'] }
                : {}),
              mentions,
            },
          },
        }))
      );
      const service = kind === 'article' ? f.comments : f.applications;
      const thread = await service.read(articleId, rootId, actor);
      expect(thread.comments.map((row) => row.content?.mentions)).toEqual([
        mentions,
        mentions,
      ]);
      const page = await service.list(articleId, {}, actor);
      expect(page.items[0].comments[0].content?.mentions).toEqual(mentions);
      expect(JSON.stringify(thread)).not.toContain(actor.identityId);
    }
  );

  it.each(['article', 'application'] as const)(
    'presents erased %s authors neutrally while preserving replies and edit authorization',
    async (kind) => {
      const f = fixture(kind);
      f.writes.resource.mockResolvedValue({
        ...f.root,
        ownerIdentityId: null,
        rootOwnerIdentityId: null,
      });
      f.writes.resources.mockResolvedValue([
        { ...f.root, ownerIdentityId: null, rootOwnerIdentityId: null },
        { ...f.child, rootOwnerIdentityId: null },
      ]);
      const service = kind === 'article' ? f.comments : f.applications;
      const result = await service.read(articleId, rootId, actor);
      expect(result.comments[0]).toMatchObject({
        id: rootId,
        content: { displayName: 'Deleted account', text: content.text },
        editable: false,
      });
      expect(result.comments[1]).toMatchObject({
        id: childId,
        content: { displayName: content.displayName, text: 'A reply' },
      });
      await expect(
        service.edit(
          articleId,
          rootId,
          { content, expectedRevision: 2 },
          { ...actor, roles: ['admin'] },
          'anonymous-edit'
        )
      ).rejects.toThrow();
      expect(f.writes.commit).not.toHaveBeenCalled();
    }
  );

  it('rejects an in-flight public read when author erasure commits during the final target lookup', async () => {
    const f = fixture();
    let lookups = 0;
    f.targets.visible.mockImplementation(async () => {
      if (++lookups === 3)
        f.writes.resources.mockResolvedValue([
          { ...f.root, revision: 3, ownerIdentityId: null },
          { ...f.child, revision: 3 },
        ]);
      return true;
    });
    await expect(f.comments.read(articleId, rootId, null)).rejects.toThrow(
      'changed while loading'
    );
  });

  it('rejects list items made stale during the final target lookup', async () => {
    const f = fixture();
    let lookups = 0;
    f.targets.visible.mockImplementation(async () => {
      if (++lookups === 5)
        f.writes.resources.mockResolvedValue([
          { ...f.root, revision: 3, ownerIdentityId: null },
          { ...f.child, revision: 3 },
        ]);
      return true;
    });
    await expect(f.comments.list(articleId, {}, null)).rejects.toThrow(
      'changed while loading'
    );
  });

  it('permits a normal member through a self-scoped policy and commits an explicit target', async () => {
    const f = fixture();
    await f.comments.create(articleId, content, actor, 'create');
    expect(f.policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'discussion.article-comment.create',
        resource: {
          type: 'article-comment-workspace',
          id: actor.identityId,
          tenantId: actor.tenantId,
        },
      })
    );
    expect(f.writes.commit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'create', target, subjectId: articleId })
    );
    expect(f.targets.visible).toHaveBeenCalledTimes(2);
  });
  it('creates application topics through a distinct self action and immutable binding', async () => {
    const f = fixture('application');
    const topic = { ...content, title: 'A public topic', tags: ['privacy'] };
    await f.applications.create(articleId, topic, actor, 'create');
    expect(f.policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'discussion.application-topic.create',
        resource: {
          type: 'application-topic-workspace',
          id: actor.identityId,
          tenantId: actor.tenantId,
        },
      })
    );
    expect(f.writes.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { kind: 'application', id: articleId },
        subjectId: articleId,
      })
    );
    const publicThread = await f.applications.read(articleId, rootId, actor);
    expect(publicThread).toMatchObject({
      title: topic.title,
      tags: topic.tags,
      replyCount: 1,
    });
    expect(publicThread.comments[0].content).toEqual(content);
    expect(JSON.stringify(publicThread)).not.toContain(actor.identityId);
    expect(
      (await f.applications.list(articleId, {}, null)).items[0].title
    ).toBe(topic.title);
  });
  it('prevents generic routes and article paths from accessing an application-bound topic', async () => {
    const f = fixture('application');
    await expect(f.queries.findOne(rootId, actor)).rejects.toThrow(
      'not available'
    );
    await expect(f.comments.read(articleId, rootId, actor)).rejects.toThrow(
      'not available'
    );
    await expect(
      f.comments.reply(articleId, childId, content, actor, 'wrong-family')
    ).rejects.toThrow('not available');
    await expect(
      f.applications.reply(childId, rootId, content, actor, 'wrong-parent')
    ).rejects.toThrow('not available');
    expect(f.payloads.put).not.toHaveBeenCalled();
  });
  it('validates root topic edits separately from reply edits and denies moderator text replacement', async () => {
    const f = fixture('application');
    await expect(
      f.applications.edit(
        articleId,
        rootId,
        { expectedRevision: 2, content },
        actor,
        'missing-title'
      )
    ).rejects.toThrow();
    const topic = { ...content, title: 'An edited title', tags: [] };
    await f.applications.edit(
      articleId,
      rootId,
      { expectedRevision: 2, content: topic },
      actor,
      'edit'
    );
    expect(f.payloads.put).toHaveBeenCalledTimes(1);
    expect(() =>
      f.applications.reply(articleId, rootId, topic, actor, 'invalid-reply')
    ).toThrow();
    await expect(
      f.applications.edit(
        articleId,
        rootId,
        { expectedRevision: 2, content: topic },
        { ...actor, identityId: 'moderator', roles: ['admin'] },
        'moderator-edit'
      )
    ).rejects.toThrow();
    expect(f.payloads.put).toHaveBeenCalledTimes(1);
  });
  it('denies an application topic after canonical parent withdrawal during payload I/O', async () => {
    const f = fixture('application');
    f.payloads.put.mockImplementation(async () => {
      f.targets.visible.mockResolvedValue(false);
      return { key: 'orphan', sha256: 'hash', bytes: 20 };
    });
    await expect(
      f.applications.create(
        articleId,
        { ...content, title: 'Topic', tags: [] },
        actor,
        'withdrawn'
      )
    ).rejects.toThrow('not available');
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it.each(['create', 'reply', 'edit', 'remove'] as const)(
    'refuses %s when the canonical article is withdrawn',
    async (operation) => {
      const f = fixture();
      f.targets.visible.mockResolvedValue(false);
      const call =
        operation === 'create'
          ? f.comments.create(articleId, content, actor, 'key')
          : operation === 'reply'
          ? f.comments.reply(articleId, rootId, content, actor, 'key')
          : operation === 'edit'
          ? f.comments.edit(
              articleId,
              rootId,
              { content, expectedRevision: 2 },
              actor,
              'key'
            )
          : f.comments.remove(
              articleId,
              rootId,
              { expectedRevision: 2 },
              actor,
              'key'
            );
      await expect(call).rejects.toThrow('not available');
      expect(f.payloads.put).not.toHaveBeenCalled();
      expect(f.writes.commit).not.toHaveBeenCalled();
    }
  );
  it('leaves only an unreferenced object when withdrawal happens during payload I/O', async () => {
    const f = fixture();
    f.payloads.put.mockImplementation(async () => {
      f.targets.visible.mockResolvedValue(false);
      return { key: 'orphan', sha256: 'hash', bytes: 20 };
    });
    await expect(
      f.comments.create(articleId, content, actor, 'key')
    ).rejects.toThrow('not available');
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it('performs no writes on policy denial or target outage', async () => {
    const f = fixture();
    f.policy.evaluate.mockResolvedValue(ok(false));
    await expect(
      f.comments.create(articleId, content, actor, 'key')
    ).rejects.toThrow();
    f.policy.evaluate.mockResolvedValue(ok(true));
    f.targets.visible.mockRejectedValue(new Error('offline'));
    await expect(
      f.comments.create(articleId, content, actor, 'key')
    ).rejects.toThrow('offline');
    expect(f.payloads.put).not.toHaveBeenCalled();
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it('denies direct discussion reads, listing and mutations for article-bound threads', async () => {
    const f = fixture();
    await expect(f.queries.findOne(rootId, null)).rejects.toThrow(
      'not available'
    );
    expect(await f.queries.findAll(null)).toEqual([]);
    await expect(
      f.commands.reply(rootId, 'body', actor, 'key')
    ).rejects.toThrow('not available');
    await expect(
      f.commands.update(
        rootId,
        { content: 'body', expectedRevision: 2 },
        actor,
        'key'
      )
    ).rejects.toThrow('not available');
    await expect(f.commands.remove(rootId, 2, actor, 'key')).rejects.toThrow(
      'not available'
    );
    expect(f.payloads.put).not.toHaveBeenCalled();
  });
  it('refuses another article path and an unbound thread', async () => {
    const f = fixture();
    await expect(
      f.comments.reply(childId, rootId, content, actor, 'key')
    ).rejects.toThrow('not available');
    f.writes.resource.mockResolvedValue({ ...f.root, target: null });
    await expect(
      f.comments.reply(articleId, rootId, content, actor, 'key')
    ).rejects.toThrow('not available');
  });
  it("allows moderator removal but never editing another member's text", async () => {
    const f = fixture(),
      moderator = { ...actor, identityId: 'moderator', roles: ['admin'] };
    await expect(
      f.comments.edit(
        articleId,
        rootId,
        { content, expectedRevision: 2 },
        moderator,
        'edit'
      )
    ).rejects.toThrow();
    await f.comments.remove(
      articleId,
      rootId,
      { expectedRevision: 2 },
      moderator,
      'remove'
    );
    expect(f.writes.commit).toHaveBeenCalledTimes(1);
  });
  it('returns plain content and ownership flags without private identities', async () => {
    const f = fixture(),
      result = await f.comments.read(articleId, rootId, actor);
    expect(result.comments[0]).toMatchObject({
      content,
      editable: true,
      removable: true,
    });
    expect(result.comments[1]).toMatchObject({
      editable: false,
      removable: false,
    });
    expect(JSON.stringify(result)).not.toContain('private-identity');
    expect(JSON.stringify(result)).not.toContain(actor.identityId);
  });
  it('rechecks parent visibility after reading the pinned projection', async () => {
    const f = fixture(),
      original = f.projections.nodes.getMockImplementation();
    if (!original) throw new Error('Missing projection test implementation');
    f.projections.nodes.mockImplementation(async (...args) => {
      const nodes = await original(...args);
      f.targets.visible.mockResolvedValue(false);
      return nodes;
    });
    await expect(f.comments.read(articleId, rootId, null)).rejects.toThrow(
      'not available'
    );
  });
  it('keeps removed replies discoverable without exposing their text or identity', async () => {
    const f = fixture();
    f.writes.resources.mockResolvedValue([
      f.root,
      { ...f.child, deletedAt: 2 },
    ]);
    const listing = await f.comments.list(articleId, {}, null);
    expect(listing.items[0].replyCount).toBe(1);
    const opened = await f.comments.read(articleId, rootId, null);
    expect(opened.replyCount).toBe(1);
    expect(opened.comments[1]).toEqual({
      id: childId,
      parentId: rootId,
      depth: 1,
      content: null,
      createdAt: null,
      updatedAt: null,
      editable: false,
      removable: false,
    });
  });
  it('returns an explicit pending error after a concurrent edit instead of stale text', async () => {
    const f = fixture();
    f.writes.resource.mockResolvedValue({ ...f.root, revision: 3 });
    await expect(f.comments.read(articleId, rootId, null)).rejects.toThrow(
      'pending'
    );
  });
  it('uses bounded canonical pagination and fetches only roots for a listing', async () => {
    const f = fixture();
    const result = await f.comments.list(
      articleId,
      { cursor: `20.${rootId}` },
      null
    );
    expect(f.threads.list).toHaveBeenCalledWith('default', articleId, {
      at: 20,
      id: rootId,
    });
    expect(f.projections.nodes).toHaveBeenCalledWith('g2', rootId);
    expect(result.items[0].comments).toHaveLength(1);
    expect(result.items[0].replyCount).toBe(1);
  });
  it.each([
    { cursor: 'bad' },
    { cursor: `9007199254740992.${rootId}` },
    { cursor: ['1'] },
    { tenantId: 'forged' },
  ])('refuses invalid query fields %#', async (query) => {
    const f = fixture();
    await expect(f.comments.list(articleId, query, null)).rejects.toThrow();
    expect(f.threads.list).not.toHaveBeenCalled();
  });
});

describe('application topic pinning', () => {
  const admin = { ...actor, roles: ['admin'] };
  it.each([true, false])(
    'commits desired pin %s under explicit policy without payload writes',
    async (pinned) => {
      const f = fixture('application');
      await f.applications.pin(
        articleId,
        rootId,
        { pinned, expectedRevision: 2 },
        admin,
        'pin'
      );
      expect(f.policy.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          actionName: 'discussion.application-topic.pin',
        })
      );
      expect(f.writes.commit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pin', pinned, nodeId: rootId })
      );
      expect(f.payloads.put).not.toHaveBeenCalled();
    }
  );
  it('denies owners without moderator role, other tenants, replies, unavailable parents and policy denial', async () => {
    for (const kind of [
      'owner',
      'tenant',
      'reply',
      'parent',
      'policy',
      'private',
    ]) {
      const f = fixture('application');
      if (kind === 'reply') f.writes.resource.mockResolvedValue(f.child);
      if (kind === 'parent') f.targets.visible.mockResolvedValue(false);
      if (kind === 'policy') f.policy.evaluate.mockResolvedValue(ok(false));
      if (kind === 'private')
        f.writes.resource.mockResolvedValue({
          ...f.root,
          visibility: 'private',
        });
      await expect(
        f.applications.pin(
          articleId,
          kind === 'reply' ? childId : rootId,
          { pinned: true, expectedRevision: 2 },
          kind === 'owner'
            ? actor
            : { ...admin, tenantId: kind === 'tenant' ? 'other' : 'default' },
          'pin'
        )
      ).rejects.toThrow();
      expect(f.writes.commit).not.toHaveBeenCalled();
    }
  });
  it('returns an authorized historical receipt without reapplying a pin, but rejects stale new commands', async () => {
    const f = fixture('application');
    await expect(
      f.applications.pin(
        articleId,
        rootId,
        { pinned: true, expectedRevision: 1 },
        admin,
        'pin'
      )
    ).rejects.toThrow('changed');
    f.writes.receipt.mockResolvedValue({
      id: rootId,
      discussionId: rootId,
      revision: 2,
      projection: 'pending',
    });
    await expect(
      f.applications.pin(
        articleId,
        rootId,
        { pinned: true, expectedRevision: 1 },
        admin,
        'pin'
      )
    ).resolves.toMatchObject({ revision: 2 });
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it('reads current canonical pin state and role hints, never payload pin fields', async () => {
    const f = fixture('application');
    f.writes.resources.mockResolvedValue([
      { ...f.root, pinned: true },
      f.child,
    ]);
    expect(await f.applications.read(articleId, rootId, admin)).toMatchObject({
      pinned: true,
      canPin: true,
    });
    expect(await f.applications.read(articleId, rootId, actor)).toMatchObject({
      pinned: true,
      canPin: false,
    });
    expect(await f.applications.read(articleId, rootId, null)).toMatchObject({
      pinned: true,
      canPin: false,
    });
  });
  it('refuses a list whose pin order changes while projected topics load', async () => {
    const f = fixture('application');
    f.threads.list
      .mockResolvedValueOnce([{ id: rootId, at: 1, pinned: false }])
      .mockResolvedValueOnce([{ id: rootId, at: 1, pinned: true }]);
    await expect(f.applications.list(articleId, {}, null)).rejects.toThrow(
      'order changed'
    );
  });
});

describe('application discussion voting', () => {
  it.each([-1, 0, 1])(
    'commits desired vote %s under explicit member policy without changing payloads',
    async (value) => {
      const f = fixture('application');
      await f.applications.vote(
        articleId,
        rootId,
        { value, expectedRevision: 2 },
        actor,
        'vote'
      );
      expect(f.policy.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          actionName: 'discussion.application-topic.vote',
          resource: {
            type: 'application-topic-workspace',
            id: actor.identityId,
            tenantId: actor.tenantId,
          },
        })
      );
      expect(f.writes.commit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'vote', value, nodeId: rootId })
      );
      expect(f.payloads.put).not.toHaveBeenCalled();
    }
  );
  it('returns an authorized historical receipt before stale-revision validation without reapplying it', async () => {
    const f = fixture('application');
    const receipt = {
      id: rootId,
      discussionId: rootId,
      revision: 2,
      projection: 'pending' as const,
    };
    f.writes.receipt.mockResolvedValue(receipt);
    expect(
      await f.applications.vote(
        articleId,
        rootId,
        { value: 1, expectedRevision: 1 },
        actor,
        'vote'
      )
    ).toEqual(receipt);
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it('denies stale revisions, other tenants, hidden posts, unavailable parents and explicit policy denial', async () => {
    for (const kind of [
      'revision',
      'tenant',
      'visibility',
      'parent',
      'policy',
    ]) {
      const f = fixture('application');
      if (kind === 'tenant')
        f.writes.resource.mockResolvedValue({ ...f.root, tenantId: 'other' });
      if (kind === 'visibility')
        f.writes.resource.mockResolvedValue({
          ...f.root,
          visibility: 'private',
        });
      if (kind === 'parent') f.targets.visible.mockResolvedValue(false);
      if (kind === 'policy') f.policy.evaluate.mockResolvedValue(ok(false));
      await expect(
        f.applications.vote(
          articleId,
          rootId,
          { value: 1, expectedRevision: kind === 'revision' ? 1 : 2 },
          actor,
          'vote'
        )
      ).rejects.toThrow();
      expect(f.writes.commit).not.toHaveBeenCalled();
    }
  });
  it('joins canonical votes to the exact thread revision without disclosing private voter identities', async () => {
    const f = fixture('application');
    f.votes.read.mockResolvedValue(
      new Map([
        [rootId, { upvotes: 2, downvotes: 1, mine: -1 }],
        [childId, { upvotes: 1, downvotes: 0, mine: 0 }],
      ])
    );
    const result = await f.applications.read(articleId, rootId, actor);
    expect(f.votes.read).toHaveBeenCalledWith(rootId, 2, actor.identityId);
    expect(result.comments[0].votes).toEqual({
      upvotes: 2,
      downvotes: 1,
      mine: -1,
    });
    expect(JSON.stringify(result)).not.toContain(actor.identityId);
    await f.applications.read(articleId, rootId, null);
    expect(f.votes.read).toHaveBeenLastCalledWith(rootId, 2, null);
  });
  it('rejects vote lookup failure and lifecycle/revision drift after the vote read', async () => {
    for (const kind of ['failure', 'revision', 'deletion']) {
      const f = fixture('application');
      f.votes.read.mockImplementation(async () => {
        if (kind === 'failure') throw new Error('SQL unavailable');
        f.writes.resources.mockResolvedValue([
          {
            ...f.root,
            ...(kind === 'revision' ? { revision: 3 } : { deletedAt: 4 }),
          },
          f.child,
        ]);
        return new Map([
          [rootId, { upvotes: 0, downvotes: 0, mine: 0 }],
          [childId, { upvotes: 0, downvotes: 0, mine: 0 }],
        ]);
      });
      await expect(
        f.applications.read(articleId, rootId, actor)
      ).rejects.toThrow();
    }
  });
  it.each([
    null,
    { kind: 'article' as const, id: articleId },
    { kind: 'application' as const, id: childId },
  ])(
    'rechecks the canonical target binding after vote I/O: %p',
    async (changedTarget) => {
      const f = fixture('application');
      f.votes.read.mockImplementation(async () => {
        f.writes.resources.mockResolvedValue([
          { ...f.root, target: changedTarget },
          f.child,
        ]);
        return new Map([
          [rootId, { upvotes: 0, downvotes: 0, mine: 0 }],
          [childId, { upvotes: 0, downvotes: 0, mine: 0 }],
        ]);
      });
      await expect(
        f.applications.read(articleId, rootId, actor)
      ).rejects.toThrow('Article comments are not available');
    }
  );
});
