import { createHash } from 'node:crypto';
import {
  RegisteredDiscussionPayloads,
  RetireDiscussionPayloads,
  type DiscussionPayloadRegistry,
  type DiscussionPayloadObjects,
} from './registered-discussion-payloads';

const nodeId = '00000000-0000-4000-8000-000000000001';
const versionId = '00000000-0000-4000-8000-000000000002';
const scope = {
  tenantId: 'Tenant',
  ownerIdentityId: 'Owner',
  actorIdentityId: 'Staff',
};
const bytes = Buffer.from('{"content":"private draft"}');
const reference = {
  key: `discussions/${nodeId}/versions/${versionId}.json`,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
const request = { identityId: 'Owner', revision: 9 };

function fixture() {
  const registry: jest.Mocked<DiscussionPayloadRegistry> = {
    reserve: jest.fn().mockResolvedValue(undefined),
    uploaded: jest.fn().mockResolvedValue(undefined),
    retiring: jest.fn().mockResolvedValue([reference]),
    retired: jest.fn().mockResolvedValue(undefined),
  };
  const objects: jest.Mocked<DiscussionPayloadObjects> = {
    put: jest.fn().mockResolvedValue(undefined),
    retire: jest.fn().mockResolvedValue(undefined),
  };
  return {
    registry,
    objects,
    writer: new RegisteredDiscussionPayloads(
      registry,
      objects,
      () => versionId
    ),
    cleanup: new RetireDiscussionPayloads(registry, objects),
  };
}

describe('registered immutable discussion payloads', () => {
  it('durably records owner and actor before putting bytes, and returns only after upload confirmation', async () => {
    const f = fixture();
    expect(await f.writer.put(nodeId, bytes, scope)).toEqual(reference);
    expect(f.registry.reserve).toHaveBeenCalledWith(nodeId, reference, scope);
    expect(f.registry.uploaded).toHaveBeenCalledWith(nodeId, reference, scope);
    expect(f.registry.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      f.objects.put.mock.invocationCallOrder[0]
    );
    expect(f.objects.put.mock.invocationCallOrder[0]).toBeLessThan(
      f.registry.uploaded.mock.invocationCallOrder[0]
    );
  });
  it('does not upload after a denied or failed reservation', async () => {
    const f = fixture();
    f.registry.reserve.mockRejectedValue(new Error('Account erased'));
    await expect(f.writer.put(nodeId, bytes, scope)).rejects.toThrow(
      'Account erased'
    );
    expect(f.objects.put).not.toHaveBeenCalled();
    expect(f.registry.uploaded).not.toHaveBeenCalled();
  });
  it('preserves the reservation when object storage fails and never confirms the upload', async () => {
    const f = fixture();
    f.objects.put.mockRejectedValue(new Error('Lost upload response'));
    await expect(f.writer.put(nodeId, bytes, scope)).rejects.toThrow(
      'Lost upload response'
    );
    expect(f.registry.reserve).toHaveBeenCalledTimes(1);
    expect(f.registry.uploaded).not.toHaveBeenCalled();
  });
  it('refuses a reference if erasure begins while its PUT is in flight', async () => {
    const f = fixture();
    f.registry.uploaded.mockRejectedValue(
      new Error('Account erased during upload')
    );
    await expect(f.writer.put(nodeId, bytes, scope)).rejects.toThrow(
      'Account erased during upload'
    );
    expect(f.objects.put).toHaveBeenCalledWith(reference, bytes);
  });
  it.each([
    ['../unsafe', bytes, scope],
    [nodeId, Buffer.alloc(0), scope],
    [nodeId, bytes, { ...scope, ownerIdentityId: ' Owner' }],
    [nodeId, bytes, { ...scope, actorIdentityId: '' }],
  ])(
    'rejects invalid scope/reference before any persistence',
    async (node, body, owner) => {
      const f = fixture();
      await expect(f.writer.put(node, body, owner)).rejects.toThrow();
      expect(f.registry.reserve).not.toHaveBeenCalled();
      expect(f.objects.put).not.toHaveBeenCalled();
    }
  );
  it('accepts unknown uploader only for an explicitly owned import', async () => {
    const f = fixture();
    await f.writer.put(nodeId, bytes, { ...scope, actorIdentityId: null });
    expect(f.registry.reserve).toHaveBeenCalledWith(nodeId, reference, {
      ...scope,
      actorIdentityId: null,
    });
  });
  it('leaves retirement pending on storage failure and recovers the same immutable key', async () => {
    const f = fixture();
    f.objects.retire.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(f.cleanup.advance(request)).rejects.toThrow(
      'storage unavailable'
    );
    expect(f.registry.retired).not.toHaveBeenCalled();
    expect(await f.cleanup.advance(request)).toBe(1);
    expect(f.registry.retired).toHaveBeenCalledWith(request, reference.key);
    expect(f.objects.retire).toHaveBeenNthCalledWith(1, reference);
    expect(f.objects.retire).toHaveBeenNthCalledWith(2, reference);
  });
  it('does not turn an empty obsolete-object batch into an erasure completion receipt', async () => {
    const f = fixture();
    f.registry.retiring.mockResolvedValue([]);
    expect(await f.cleanup.advance(request)).toBe(0);
    expect(f.registry.retired).not.toHaveBeenCalled();
  });
});
