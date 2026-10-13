import { createHash } from 'node:crypto';
import type {
  DiscussionGenerationHead,
  DiscussionGenerationNode,
  DiscussionSnapshot,
  DiscussionSnapshotNode,
} from '@apps/shared';
import {
  DiscussionGenerationStore,
  InvalidSnapshotError,
  materializeDiscussion,
} from './materialization';

const body = Buffer.from(JSON.stringify({ content: 'Original body' }));
const reference = {
  key: 'immutable/object',
  bytes: body.length,
  sha256: createHash('sha256').update(body).digest('hex'),
};
function node(id: string, parentId: string | null): DiscussionSnapshotNode {
  return {
    id,
    referenceKey: id,
    kind: parentId ? 'comment' : 'discussion',
    parentId,
    ownerIdentityId: 'owner',
    state: 'published',
    visibility: 'public',
    createdAt: 10,
    updatedAt: null,
    deletedAt: null,
    likeCount: 0,
    payload: reference,
  };
}
function snapshot(revision = 1): DiscussionSnapshot {
  return {
    discussionId: 'root',
    tenantId: 'tenant',
    revision,
    subjectId: null,
    subjectReferenceKey: null,
    nodes: [node('root', null), node('reply', 'root'), node('nested', 'reply')],
  };
}

class MemoryGenerations implements DiscussionGenerationStore {
  head: DiscussionGenerationHead | undefined;
  nodes = new Map<string, DiscussionGenerationNode>();
  failAtBatch: number | undefined;
  batches = 0;
  async writeNodes(nodes: DiscussionGenerationNode[]) {
    if (++this.batches === this.failAtBatch)
      throw new Error('Disconnected during generation write');
    for (const node of nodes) {
      const current = this.nodes.get(node._id);
      if (
        current &&
        current.revision === node.revision &&
        current.generation !== node.generation
      )
        throw new InvalidSnapshotError(
          'Conflicting snapshots at the same revision'
        );
      if (!current || current.revision < node.revision)
        this.nodes.set(node._id, node);
    }
  }
  async publish(head: DiscussionGenerationHead) {
    if (this.head && this.head.revision > head.revision)
      return 'superseded' as const;
    if (this.head?.revision === head.revision) {
      if (this.head.fingerprint !== head.fingerprint)
        throw new InvalidSnapshotError(
          'Conflicting snapshots at the same revision'
        );
      return 'unchanged' as const;
    }
    this.head = head;
    return 'published' as const;
  }
  visible() {
    return [...this.nodes.values()].filter(
      (node) => node.generation === this.head?.generation
    );
  }
}

const payloads = { read: async () => body };
const project = (
  source: DiscussionSnapshot,
  store: DiscussionGenerationStore
) =>
  materializeDiscussion('root', { read: async () => source }, payloads, store);

describe('revisioned discussion materialization', () => {
  it('materializes explicit anonymous ownership and preserves replies through replay', async () => {
    const store = new MemoryGenerations();
    await project(snapshot(1), store);
    const anonymous = snapshot(2);
    anonymous.nodes[0].ownerIdentityId = null;
    expect(await project(anonymous, store)).toBe('published');
    expect(store.nodes.get('root')?.ownerIdentityId).toBeNull();
    expect(store.nodes.get('reply')?.ownerIdentityId).toBe('owner');
    expect(await project(snapshot(1), store)).toBe('superseded');
    expect(store.nodes.get('root')?.ownerIdentityId).toBeNull();
  });

  it('converges application-bound snapshots and rejects a same-revision kind change', async () => {
    const store = new MemoryGenerations();
    const bound = {
      ...snapshot(),
      subjectId: 'application-id',
      subjectKind: 'application' as const,
    };
    expect(await project(bound, store)).toBe('published');
    expect(await project(bound, store)).toBe('unchanged');
    expect(store.head?.subjectKind).toBe('application');
    await expect(
      project({ ...bound, subjectKind: 'article' }, store)
    ).rejects.toThrow('Conflicting snapshots');
  });
  it('includes an immutable article binding in the generation fingerprint without changing unbound snapshots', async () => {
    const store = new MemoryGenerations();
    const original = { ...snapshot(), subjectId: 'article-id' };
    await project(original, store);
    expect(store.head).not.toHaveProperty('subjectKind');
    await expect(
      project({ ...original, subjectKind: 'article' }, store)
    ).rejects.toThrow('Conflicting snapshots');
    const linked = new MemoryGenerations();
    await project({ ...original, subjectKind: 'article' }, linked);
    expect(linked.head?.subjectKind).toBe('article');
    expect(await project({ ...original, subjectKind: 'article' }, linked)).toBe(
      'unchanged'
    );
    await expect(
      project(
        { ...snapshot(), subjectKind: 'article' },
        new MemoryGenerations()
      )
    ).rejects.toThrow('Invalid discussion target');
  });
  it('converges under duplicate and reordered deliveries, independent of source row order', async () => {
    const store = new MemoryGenerations();
    const current = snapshot(2);
    expect(await project(current, store)).toBe('published');
    const head = store.head;
    expect(
      await project({ ...current, nodes: [...current.nodes].reverse() }, store)
    ).toBe('unchanged');
    expect(await project(snapshot(1), store)).toBe('superseded');
    expect(store.head).toEqual(head);
    expect(store.head?.descendantsCount).toBe(2);
    expect(store.visible().find((node) => node.id === 'nested')?.depth).toBe(2);
  });

  it('a delayed older worker cannot replace a newer published generation', async () => {
    const store = new MemoryGenerations();
    let resume: () => void = () => {
      throw new Error('Missing gate');
    };
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const slowStore: DiscussionGenerationStore = {
      writeNodes: (nodes) => store.writeNodes(nodes),
      publish: async (head) => {
        await gate;
        return store.publish(head);
      },
    };
    const older = project(snapshot(1), slowStore);
    await project(snapshot(2), store);
    resume();
    expect(await older).toBe('superseded');
    expect(store.head?.revision).toBe(2);
  });

  it('keeps the old head after a partial write, exposes no mixed generation and recovers on retry', async () => {
    const store = new MemoryGenerations();
    await project(snapshot(), store);
    const oldHead = store.head;
    const expanded = snapshot(2);
    expanded.nodes.push(
      ...Array.from({ length: 100 }, (_, i) => node(`reply-${i}`, 'root'))
    );
    store.failAtBatch = store.batches + 2;
    await expect(project(expanded, store)).rejects.toThrow('Disconnected');
    expect(store.head).toEqual(oldHead);
    expect(store.visible().length).toBeLessThan(3);
    expect(
      store.visible().every((node) => node.generation === oldHead?.generation)
    ).toBe(true);
    expect(await project(expanded, store)).toBe('published');
    expect(store.visible()).toHaveLength(103);
    expect(store.head?.descendantsCount).toBe(102);
  });

  it('cannot restore removed bytes when an old worker resumes before its first projection batch', async () => {
    const store = new MemoryGenerations();
    let release: () => void = () => undefined;
    let entered: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const old = project(snapshot(1), {
      writeNodes: async (nodes) => {
        entered();
        await gate;
        await store.writeNodes(nodes);
      },
      publish: (head) => store.publish(head),
    });
    await paused;
    const removed = snapshot(2);
    removed.nodes[1].deletedAt = 20;
    removed.nodes[1].payload = null;
    await project(removed, store);
    release();
    expect(await old).toBe('superseded');
    expect(store.nodes.size).toBe(3);
    expect(store.nodes.get('reply')?.payload).toBeNull();
    expect([...store.nodes.values()].every((node) => node.revision === 2)).toBe(
      true
    );
  });

  it('detects inconsistent snapshots at one revision without mixing their documents', async () => {
    const store = new MemoryGenerations();
    await project(snapshot(), store);
    const inconsistent = snapshot();
    inconsistent.nodes[1].visibility = 'private';
    await expect(project(inconsistent, store)).rejects.toThrow('Conflicting');
    expect(
      store.visible().find((node) => node.id === 'reply')?.visibility
    ).toBe('public');
  });

  it('propagates comment deletion without losing reply ancestry or resurrecting old payloads', async () => {
    const store = new MemoryGenerations();
    await project(snapshot(), store);
    const deleted = snapshot(2);
    deleted.nodes[1].deletedAt = 20;
    deleted.nodes[1].payload = null;
    await project(deleted, store);
    expect(store.head?.descendantsCount).toBe(1);
    expect(
      store.visible().find((node) => node.id === 'reply')?.payload
    ).toBeNull();
    expect(store.visible().find((node) => node.id === 'nested')?.depth).toBe(2);
    await project(snapshot(1), store);
    expect(store.visible().find((node) => node.id === 'reply')?.deletedAt).toBe(
      20
    );
  });

  it('root deletion suppresses all descendant payloads and does not load removed objects', async () => {
    const store = new MemoryGenerations();
    const deleted = snapshot(2);
    deleted.nodes[0].deletedAt = 20;
    const read = jest
      .fn()
      .mockRejectedValue(new Error('Objects no longer available'));
    await materializeDiscussion(
      'root',
      { read: async () => deleted },
      { read },
      store
    );
    expect(read).not.toHaveBeenCalled();
    expect(store.visible().every((node) => node.payload === null)).toBe(true);
    expect(store.head?.descendantsCount).toBe(0);
  });

  it('updates bodies and can rebuild an equivalent view from authoritative data alone', async () => {
    const edited = Buffer.from(JSON.stringify({ content: 'Edited body' }));
    const current = snapshot(3);
    current.nodes[1].updatedAt = 30;
    current.nodes[1].likeCount = 4;
    current.nodes[1].payload = {
      key: 'immutable/edited',
      bytes: edited.length,
      sha256: createHash('sha256').update(edited).digest('hex'),
    };
    const loader = {
      read: async (ref: typeof reference) =>
        ref.key === 'immutable/edited' ? edited : body,
    };
    const live = new MemoryGenerations();
    await project(snapshot(), live);
    await materializeDiscussion(
      'root',
      { read: async () => current },
      loader,
      live
    );
    const rebuilt = new MemoryGenerations();
    await materializeDiscussion(
      'root',
      { read: async () => current },
      loader,
      rebuilt
    );
    expect(rebuilt.head).toEqual(live.head);
    expect(rebuilt.visible()).toEqual(live.visible());
    expect(rebuilt.visible().find((node) => node.id === 'reply')).toMatchObject(
      { payload: { content: 'Edited body' }, likeCount: 4 }
    );
  });

  it.each([
    [
      'missing parent',
      (s: DiscussionSnapshot) => {
        s.nodes[1].parentId = 'missing';
      },
    ],
    [
      'cycle',
      (s: DiscussionSnapshot) => {
        s.nodes[1].parentId = 'nested';
      },
    ],
    [
      'duplicate identity',
      (s: DiscussionSnapshot) => {
        s.nodes.push(s.nodes[0]);
      },
    ],
    [
      'missing root',
      (s: DiscussionSnapshot) => {
        s.nodes.shift();
      },
    ],
    [
      'missing payload',
      (s: DiscussionSnapshot) => {
        s.nodes[1].payload = null;
      },
    ],
    [
      'unsafe revision',
      (s: DiscussionSnapshot) => {
        s.revision = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      'excess depth',
      (s: DiscussionSnapshot) => {
        for (let i = 0; i < 65; i++)
          s.nodes.push(node(`deep-${i}`, i === 0 ? 'root' : `deep-${i - 1}`));
      },
    ],
  ])('fails explicitly on %s before writing', async (_label, change) => {
    const source = snapshot();
    change(source);
    const store = new MemoryGenerations();
    await expect(project(source, store)).rejects.toBeInstanceOf(
      InvalidSnapshotError
    );
    expect(store.nodes.size).toBe(0);
    expect(store.head).toBeUndefined();
  });

  it.each([Buffer.from('{}'), Buffer.alloc(0)])(
    'rejects corrupt payloads before any projection writes',
    async (invalid) => {
      const store = new MemoryGenerations();
      await expect(
        materializeDiscussion(
          'root',
          { read: async () => snapshot() },
          { read: async () => invalid },
          store
        )
      ).rejects.toThrow('hash or size');
      expect(store.nodes.size).toBe(0);
    }
  );
});
