import { createHash } from 'node:crypto';
import {
  DISCUSSION_MAX_DEPTH,
  DISCUSSION_MAX_PAYLOAD_BYTES,
} from '@apps/shared';
import {
  DiscussionOwnershipManifest,
  LegacyDiscussionBackfill,
  LegacyDiscussionPayloads,
  LegacyDiscussionRepository,
  LegacyDiscussionSnapshot,
  parseDiscussionOwnershipManifest,
} from './legacy-discussion-backfill';
import { ImmutableDiscussionPayloads } from './discussion-write.port';

const id = (value: number) =>
  `00000000-0000-7000-8000-${value.toString().padStart(12, '0')}`;
const rootId = id(1);
const commentId = id(2);
const fingerprint = (body: Buffer) =>
  createHash('sha256').update(body).digest('hex');

function fixture() {
  const manifest: DiscussionOwnershipManifest = {
    version: 1,
    discussionId: rootId,
    tenantId: 'verified-tenant',
    owners: [
      { nodeId: rootId, identityId: 'verified-owner' },
      { nodeId: commentId, identityId: 'verified-commenter' },
    ],
  };
  const snapshot: LegacyDiscussionSnapshot = {
    discussionId: rootId,
    nodes: [rootId, commentId].map((nodeId, index) => ({
      id: nodeId,
      referenceKey: id(index + 100),
      kind: index ? 'comment' : 'discussion',
      state: 'published',
      visibility: 'private',
      createdAt: 10,
      updatedAt: null,
      deletedAt: null,
      likeCount: index,
    })),
    relations: [
      {
        id: id(500),
        fromContentId: commentId,
        toContentId: rootId,
        relationType: 'replies',
        createdAt: 10,
      },
    ],
  };
  const body = Buffer.from(
    JSON.stringify({
      content: 'legacy body',
      authorId: 'untrusted-payload-author',
    })
  );
  const repository: jest.Mocked<LegacyDiscussionRepository> = {
    read: jest.fn().mockImplementation(async () => structuredClone(snapshot)),
    receipt: jest.fn().mockResolvedValue(null),
    commit: jest.fn().mockImplementation(async (prepared) => ({
      discussionId: rootId,
      manifestFingerprint: prepared.manifestFingerprint,
      fingerprint: prepared.fingerprint,
      revision: 1,
      committedAt: 20,
    })),
  };
  const legacy: jest.Mocked<LegacyDiscussionPayloads> = {
    read: jest.fn().mockImplementation(async () => Buffer.from(body)),
  };
  const immutable: jest.Mocked<ImmutableDiscussionPayloads> = {
    put: jest
      .fn()
      .mockImplementation(async (nodeId: string, bytes: Buffer) => ({
        key: `discussions/${nodeId}/versions/version.json`,
        bytes: bytes.length,
        sha256: fingerprint(bytes),
      })),
  };
  return {
    manifest,
    snapshot,
    body,
    repository,
    legacy,
    immutable,
    backfill: new LegacyDiscussionBackfill(repository, legacy, immutable),
  };
}

describe('legacy discussion backfill', () => {
  it('plans without changing any store and is deterministic across input order', async () => {
    const f = fixture();
    const first = await f.backfill.plan(f.manifest);
    f.snapshot.nodes.reverse();
    f.manifest.owners.reverse();
    const second = await f.backfill.plan(f.manifest);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(f.repository.commit).not.toHaveBeenCalled();
    expect(f.immutable.put).not.toHaveBeenCalled();
  });

  it('commits only verified ownership, unchanged lifecycle and immutable payload references', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(f.manifest);
    const receipt = await f.backfill.apply(f.manifest, plan.fingerprint, true);
    expect(receipt).toMatchObject({
      discussionId: rootId,
      revision: 1,
      fingerprint: plan.fingerprint,
    });
    const prepared = f.repository.commit.mock.calls[0][0];
    expect(prepared.manifest.owners).toEqual(f.manifest.owners);
    expect(
      prepared.snapshot.nodes.every((node) => node.visibility === 'private')
    ).toBe(true);
    expect(prepared.payloads).toHaveLength(2);
    expect(prepared.payloads[0].reference?.sha256).toBe(fingerprint(f.body));
  });

  it.each([
    [
      'missing mapping',
      (f: ReturnType<typeof fixture>) => f.manifest.owners.pop(),
    ],
    [
      'extra mapping',
      (f: ReturnType<typeof fixture>) =>
        f.manifest.owners.push({ nodeId: id(3), identityId: 'extra' }),
    ],
    [
      'duplicate owner',
      (f: ReturnType<typeof fixture>) =>
        f.manifest.owners.push(f.manifest.owners[0]),
    ],
    [
      'ambiguous identity',
      (f: ReturnType<typeof fixture>) =>
        (f.manifest.owners[0].identityId = ' owner '),
    ],
  ])('rejects %s before reading payloads', async (_name, change) => {
    const f = fixture();
    change(f);
    await expect(f.backfill.plan(f.manifest)).rejects.toThrow();
    expect(f.legacy.read).not.toHaveBeenCalled();
    expect(f.immutable.put).not.toHaveBeenCalled();
  });

  it('rejects unknown manifest fields rather than ignoring an ownership typo', () => {
    expect(() =>
      parseDiscussionOwnershipManifest({
        ...fixture().manifest,
        owner: 'invented',
      })
    ).toThrow('fields');
  });

  it.each([
    [
      'missing parent',
      (s: LegacyDiscussionSnapshot) => (s.relations.length = 0),
    ],
    [
      'foreign parent',
      (s: LegacyDiscussionSnapshot) => (s.relations[0].toContentId = id(99)),
    ],
    [
      'multiple parents',
      (s: LegacyDiscussionSnapshot) =>
        s.relations.push({ ...s.relations[0], id: id(501) }),
    ],
    [
      'cycle',
      (s: LegacyDiscussionSnapshot) => (s.relations[0].toContentId = commentId),
    ],
    [
      'non-discussion root',
      (s: LegacyDiscussionSnapshot) => (s.nodes[0].kind = 'comment'),
    ],
    [
      'foreign snapshot',
      (s: LegacyDiscussionSnapshot) => (s.discussionId = id(99)),
    ],
  ])('rejects graph corruption: %s', async (_name, change) => {
    const f = fixture();
    change(f.snapshot);
    await expect(f.backfill.plan(f.manifest)).rejects.toThrow();
    expect(f.legacy.read).not.toHaveBeenCalled();
  });

  it('bounds reply depth before reading any objects', async () => {
    const f = fixture();
    for (let index = 3; index <= DISCUSSION_MAX_DEPTH + 2; index++) {
      f.snapshot.nodes.push({ ...f.snapshot.nodes[1], id: id(index) });
      f.snapshot.relations.push({
        ...f.snapshot.relations[0],
        id: id(500 + index),
        fromContentId: id(index),
        toContentId: id(index - 1),
      });
      f.manifest.owners.push({ nodeId: id(index), identityId: 'owner' });
    }
    await expect(f.backfill.plan(f.manifest)).rejects.toThrow('depth');
    expect(f.legacy.read).not.toHaveBeenCalled();
  });

  it('preserves tombstones without requiring missing deleted bodies', async () => {
    const f = fixture();
    f.snapshot.nodes[1].deletedAt = 15;
    const plan = await f.backfill.plan(f.manifest);
    await f.backfill.apply(f.manifest, plan.fingerprint, true);
    expect(
      f.legacy.read.mock.calls.every(([nodeId]) => nodeId === rootId)
    ).toBe(true);
    expect(f.immutable.put).toHaveBeenCalledTimes(1);
    expect(f.repository.commit.mock.calls[0][0].payloads[1]).toEqual({
      nodeId: commentId,
      reference: null,
    });
    expect(
      f.repository.commit.mock.calls[0][0].snapshot.nodes[1].deletedAt
    ).toBe(15);
  });

  it.each([
    Buffer.from('broken'),
    Buffer.from('{}'),
    Buffer.alloc(DISCUSSION_MAX_PAYLOAD_BYTES + 1),
  ])('rejects malformed or excessive legacy bodies', async (body) => {
    const f = fixture();
    f.legacy.read.mockResolvedValue(body);
    await expect(f.backfill.plan(f.manifest)).rejects.toThrow();
    expect(f.immutable.put).not.toHaveBeenCalled();
  });

  it('reports missing legacy objects instead of manufacturing empty content', async () => {
    const f = fixture();
    f.legacy.read.mockRejectedValue(new Error('NoSuchKey'));
    await expect(f.backfill.plan(f.manifest)).rejects.toThrow('NoSuchKey');
  });

  it('requires the maintenance precondition before any read or write', async () => {
    const f = fixture();
    await expect(
      f.backfill.apply(f.manifest, 'a'.repeat(64), false)
    ).rejects.toThrow('maintenance');
    expect(f.repository.read).not.toHaveBeenCalled();
    expect(f.repository.receipt).not.toHaveBeenCalled();
  });

  it.each(['body', 'owner', 'graph'] as const)(
    'rejects %s drift after planning before upload',
    async (change) => {
      const f = fixture();
      const plan = await f.backfill.plan(f.manifest);
      if (change === 'body')
        f.legacy.read.mockResolvedValue(Buffer.from('{"content":"changed"}'));
      if (change === 'owner') f.manifest.owners[0].identityId = 'changed';
      if (change === 'graph') f.snapshot.nodes[1].likeCount++;
      await expect(
        f.backfill.apply(f.manifest, plan.fingerprint, true)
      ).rejects.toThrow('changed');
      expect(f.immutable.put).not.toHaveBeenCalled();
    }
  );

  it('detects mutable-object drift during upload and never commits it', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(f.manifest);
    f.immutable.put.mockImplementation(async (_nodeId, body) => {
      f.legacy.read.mockResolvedValue(
        Buffer.from('{"content":"concurrent legacy edit"}')
      );
      return {
        key: 'immutable-key',
        sha256: fingerprint(body),
        bytes: body.length,
      };
    });
    await expect(
      f.backfill.apply(f.manifest, plan.fingerprint, true)
    ).rejects.toThrow('payload changed');
    expect(f.repository.commit).not.toHaveBeenCalled();
  });

  it('leaves uploaded objects unreferenced if a later upload fails', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(f.manifest);
    f.immutable.put
      .mockResolvedValueOnce({
        key: 'first-upload',
        sha256: fingerprint(f.body),
        bytes: f.body.length,
      })
      .mockRejectedValueOnce(new Error('Object store unavailable'));
    await expect(
      f.backfill.apply(f.manifest, plan.fingerprint, true)
    ).rejects.toThrow('Object store');
    expect(f.repository.commit).not.toHaveBeenCalled();
  });

  it('recovers a receipt committed by another importer after the initial lookup', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(f.manifest);
    const committed = {
      discussionId: rootId,
      manifestFingerprint: plan.manifestFingerprint,
      fingerprint: plan.fingerprint,
      revision: 1 as const,
      committedAt: 20,
    };
    f.repository.receipt
      .mockResolvedValueOnce(null)
      .mockResolvedValue(committed);
    f.repository.read.mockRejectedValue(
      new Error('Already versioned by concurrent importer')
    );
    expect(await f.backfill.apply(f.manifest, plan.fingerprint, true)).toEqual(
      committed
    );
    expect(f.immutable.put).not.toHaveBeenCalled();
  });

  it('reports SQL failure after copies without returning a committed receipt', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(f.manifest);
    f.repository.commit.mockRejectedValue(new Error('SQL rollback'));
    await expect(
      f.backfill.apply(f.manifest, plan.fingerprint, true)
    ).rejects.toThrow('SQL rollback');
    expect(f.immutable.put).toHaveBeenCalledTimes(2);
  });

  it('replays a committed plan without rereading legacy stores or uploading again', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(f.manifest);
    const receipt = await f.backfill.apply(f.manifest, plan.fingerprint, true);
    f.repository.receipt.mockResolvedValue(receipt);
    f.repository.read.mockClear();
    f.immutable.put.mockClear();
    expect(await f.backfill.apply(f.manifest, plan.fingerprint, true)).toEqual(
      receipt
    );
    expect(f.repository.read).not.toHaveBeenCalled();
    expect(f.immutable.put).not.toHaveBeenCalled();
    f.manifest.owners[0].identityId = 'another-owner';
    await expect(
      f.backfill.apply(f.manifest, plan.fingerprint, true)
    ).rejects.toThrow('another plan');
  });
});
