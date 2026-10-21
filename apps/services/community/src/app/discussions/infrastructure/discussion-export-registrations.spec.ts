import type { MysqlSnapshotReader } from '@sdk/extras/mysql';
import {
  assertExportPayloadRegistration,
  discussionExportRegistrations,
} from './discussion-export-registrations';

const nodeId = '00000000-0000-4000-8000-000000000001';
const versionId = '00000000-0000-4000-8000-000000000002';
const key = `discussions/${nodeId}/versions/${versionId}.json`;
const reference = { key, sha256: 'a'.repeat(64), bytes: 20 };
function record(override: Record<string, unknown> = {}) {
  return {
    objectKey: key,
    nodeId,
    ownerIdentityId: 'Owner',
    actorIdentityId: 'Owner',
    tenantId: 'default',
    sha256: reference.sha256,
    bytes: 20,
    state: 'uploaded',
    registeredAt: 100,
    retiredAt: null,
    referenceNodeId: null,
    referenceOwnerId: null,
    referenceTenantId: null,
    referenceHash: null,
    referenceBytes: null,
    ...override,
  };
}
function fixture(rows = [record()], uploads: Record<string, unknown>[] = []) {
  const query = jest
    .fn()
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce(uploads);
  const reader = { query } as unknown as MysqlSnapshotReader;
  const payloads = {
    read: jest.fn().mockResolvedValue('Own content'),
    observe: jest.fn().mockResolvedValue({ kind: 'absent' }),
  };
  const controller = new AbortController();
  const capture = () =>
    discussionExportRegistrations(reader, 'Owner', payloads, controller.signal);
  return { query, reader, payloads, controller, capture };
}
async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const value of values) result.push(value);
  return result;
}

describe('Discussion registered-payload account export', () => {
  it.each([
    ['Owner', 'account'],
    ['PrivateStaffIdentity', 'other'],
    [null, 'unknown'],
  ])(
    'exports owner bytes with %s uploader represented as %s',
    async (actorIdentityId, uploadedBy) => {
      const f = fixture([record({ actorIdentityId })]);
      const records = await collect(f.capture());
      expect(records).toEqual([
        {
          collection: 'payload-versions',
          data: {
            nodeId,
            versionId,
            tenantId: 'default',
            state: 'uploaded',
            registeredAt: 100,
            retiredAt: null,
            current: false,
            sha256: reference.sha256,
            bytes: 20,
            uploadedBy,
            storage: 'present',
            content: 'Own content',
          },
        },
      ]);
      expect(JSON.stringify(records)).not.toContain('PrivateStaffIdentity');
      expect(JSON.stringify(records)).not.toContain('discussions/');
    }
  );

  it('exports only action metadata for uploads owned by somebody else', async () => {
    const f = fixture(
      [],
      [record({ ownerIdentityId: 'ForeignPrivateIdentity' })]
    );
    const records = await collect(f.capture());
    expect(records).toEqual([
      {
        collection: 'payload-uploads',
        data: {
          nodeId,
          versionId,
          tenantId: 'default',
          state: 'uploaded',
          registeredAt: 100,
          retiredAt: null,
        },
      },
    ]);
    expect(f.payloads.read).not.toHaveBeenCalled();
    expect(f.payloads.observe).not.toHaveBeenCalled();
    expect(f.query.mock.calls[1][0]).not.toContain('discussion_write_nodes');
    expect(JSON.stringify(records)).not.toContain('ForeignPrivateIdentity');
  });

  it('labels absence as an observation only for an unconfirmed reservation', async () => {
    const f = fixture([record({ state: 'reserved' })]);
    expect(await collect(f.capture())).toMatchObject([
      { data: { state: 'reserved', storage: 'not-observed', content: null } },
    ]);
    expect(f.payloads.read).not.toHaveBeenCalled();
    expect(f.payloads.observe).toHaveBeenCalledWith(
      nodeId,
      reference,
      f.controller.signal
    );
  });

  it('includes bytes that arrived without upload confirmation', async () => {
    const f = fixture([record({ state: 'reserved' })]);
    f.payloads.observe.mockResolvedValue({
      kind: 'present',
      content: 'Unconfirmed own bytes',
    });
    expect(await collect(f.capture())).toMatchObject([
      {
        data: {
          state: 'reserved',
          storage: 'present',
          content: 'Unconfirmed own bytes',
        },
      },
    ]);
  });

  it('keeps confirmed retirement metadata without reading the marker', async () => {
    const f = fixture([record({ state: 'retired', retiredAt: 200 })]);
    expect(await collect(f.capture())).toMatchObject([
      { data: { storage: 'retired', retiredAt: 200, content: null } },
    ]);
    expect(f.payloads.read).not.toHaveBeenCalled();
    expect(f.payloads.observe).not.toHaveBeenCalled();
  });

  it('cannot finish while retirement still leaves storage outcome unresolved', async () => {
    const f = fixture([record({ state: 'retiring' })]);
    await expect(collect(f.capture())).rejects.toThrow(
      'retirement is still pending'
    );
    expect(f.payloads.read).not.toHaveBeenCalled();
  });

  it.each(['uploaded', 'committed'])(
    'requires exact retained bytes for %s history',
    async (state) => {
      const f = fixture([record({ state })]);
      f.payloads.read.mockRejectedValue(new Error('History bytes unavailable'));
      await expect(collect(f.capture())).rejects.toThrow(
        'History bytes unavailable'
      );
      expect(f.payloads.observe).not.toHaveBeenCalled();
    }
  );

  it.each([
    { ownerIdentityId: 'owner' },
    { state: 'unexpected' },
    { bytes: 0 },
    { referenceNodeId: nodeId },
    { state: 'retired', retiredAt: null },
  ])(
    'rejects corrupt scope, lifecycle or current authority: %p',
    async (override) => {
      const f = fixture([record(override)]);
      await expect(collect(f.capture())).rejects.toThrow(
        'canonical discussion payload registration'
      );
      expect(f.payloads.read).not.toHaveBeenCalled();
    }
  );

  it('rejects duplicate registry keys caused by inconsistent canonical references', async () => {
    const f = fixture([record(), record()]);
    await expect(collect(f.capture())).rejects.toThrow('canonical');
  });

  it('does not yield bytes returned after capture cancellation', async () => {
    const f = fixture();
    f.payloads.read.mockImplementation(async () => {
      f.controller.abort(new Error('Stop capture'));
      return 'Late content';
    });
    await expect(collect(f.capture())).rejects.toThrow('Stop capture');
  });

  it('requires exact committed ownership, tenant and checksum for a current contribution', async () => {
    for (const override of [
      {},
      { ownerIdentityId: 'Foreign' },
      { tenantId: 'other' },
      { state: 'uploaded' },
      { sha256: 'b'.repeat(64) },
      { bytes: 21 },
    ]) {
      const f = fixture([record({ state: 'committed', ...override })]);
      const validation = assertExportPayloadRegistration(
        f.reader,
        'Owner',
        'default',
        nodeId,
        reference
      );
      if (Object.keys(override).length)
        await expect(validation).rejects.toThrow('canonical');
      else await validation;
    }
    const missing = fixture([]);
    await expect(
      assertExportPayloadRegistration(
        missing.reader,
        'Owner',
        'default',
        nodeId,
        reference
      )
    ).rejects.toThrow('canonical');
  });
});
