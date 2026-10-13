import {
  DiscussionGenerationHead,
  DiscussionGenerationNode,
} from '@apps/shared';
import { MongoGenerationInspector } from './mongo-generation-inspector';

const authority = { id: 'root', tenantId: 'tenant', revision: 3, nodeCount: 2 };
function fixture() {
  const head: DiscussionGenerationHead = {
    _id: 'root',
    tenantId: 'tenant',
    revision: 3,
    nodeCount: 2,
    fingerprint: 'a'.repeat(64),
    generation: `root:3:${'a'.repeat(64)}`,
    schemaVersion: 3,
    subjectId: null,
    subjectReferenceKey: null,
    visibility: 'private',
    state: 'published',
    deletedAt: null,
    createdAt: 10,
    lastActivityAt: 10,
    descendantsCount: 1,
  };
  const documents: DiscussionGenerationNode[] = ['root', 'reply'].map(
    (id, index) => ({
      _id: id,
      id,
      referenceKey: id,
      generation: head.generation,
      revision: 3,
      schemaVersion: 3,
      discussionId: 'root',
      parentId: index ? 'root' : null,
      kind: index ? 'comment' : 'discussion',
      depth: index,
      ownerIdentityId: 'owner',
      state: 'published',
      visibility: 'private',
      createdAt: 10,
      updatedAt: null,
      deletedAt: null,
      likeCount: 0,
      payload: { content: 'body' },
    })
  );
  const limit = jest
    .fn()
    .mockImplementation(() => ({ toArray: async () => documents }));
  const find = jest.fn().mockReturnValue({ limit });
  const findOne = jest.fn().mockImplementation(async () => head);
  return {
    head,
    documents,
    limit,
    find,
    findOne,
    inspector: new MongoGenerationInspector({ find }, { findOne }),
  };
}

describe('published discussion generation inspection', () => {
  it('requeues a schema-2 generation for authoritative upgrade at the same revision', async () => {
    const f = fixture();
    Object.assign(f.head, { schemaVersion: 2 });
    expect(await f.inspector.inspect(authority)).toBe('stale');
    expect(f.find).not.toHaveBeenCalled();
  });
  it('pins a complete generation and bounds the metadata query', async () => {
    const f = fixture();
    expect(await f.inspector.inspect(authority)).toBe('current');
    expect(f.find.mock.calls[0][0]).toEqual({ generation: f.head.generation });
    expect(f.limit).toHaveBeenCalledWith(2001);
    expect(f.find.mock.calls[0][1].projection.payload).toBeUndefined();
  });

  it('recognizes missing heads and partial document loss', async () => {
    const f = fixture();
    f.documents.pop();
    expect(await f.inspector.inspect(authority)).toBe('incomplete');
    f.findOne.mockResolvedValue(null);
    expect(await f.inspector.inspect(authority)).toBe('missing');
  });

  it('separates stale and advanced heads before examining their old generations', async () => {
    const f = fixture();
    f.head.revision = 2;
    expect(await f.inspector.inspect(authority)).toBe('stale');
    f.head.revision = 4;
    expect(await f.inspector.inspect(authority)).toBe('ahead');
    expect(f.find).not.toHaveBeenCalled();
  });

  it.each([
    (f: ReturnType<typeof fixture>) => (f.head.tenantId = 'other-tenant'),
    (f: ReturnType<typeof fixture>) => (f.head.fingerprint = 'invalid'),
    (f: ReturnType<typeof fixture>) => (f.head.generation = 'old-generation'),
    (f: ReturnType<typeof fixture>) => (f.head.nodeCount = 1),
    (f: ReturnType<typeof fixture>) =>
      (f.documents[1].discussionId = 'foreign'),
    (f: ReturnType<typeof fixture>) => (f.documents[1].parentId = 'reply'),
    (f: ReturnType<typeof fixture>) => (f.documents[1].depth = 42),
    (f: ReturnType<typeof fixture>) => (f.documents[1].revision = 2),
    (f: ReturnType<typeof fixture>) => (f.documents[1].id = 'root'),
  ])(
    'reports conflicting scope, structure or metadata for explicit recovery',
    async (corrupt) => {
      const f = fixture();
      corrupt(f);
      expect(await f.inspector.inspect(authority)).toBe('conflict');
    }
  );
});
