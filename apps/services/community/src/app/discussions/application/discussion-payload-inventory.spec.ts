import { createHash } from 'node:crypto';
import { DISCUSSION_MAX_PAYLOAD_BYTES } from '@apps/shared';
import {
  InventoryDiscussionPayloads,
  discussionInventoryKey,
  type DiscussionInventoryDecision,
  type DiscussionInventoryProgress,
  type DiscussionPayloadInventoryObjects,
  type DiscussionPayloadInventoryRepository,
} from './discussion-payload-inventory';

const nodeId = '12345678-1234-1234-1234-123456789012';
const key = `discussions/${nodeId}/versions/${nodeId}.json`;
const legacy = `discussions/${nodeId}/content`;
const body = Buffer.from('{"content":"owned history"}');
function fixture(kind: DiscussionInventoryDecision['kind'] = 'adopt') {
  let progress: DiscussionInventoryProgress = {
    revision: 1,
    after: '',
    completedAt: null,
    legacyWritersStoppedAt: null,
    lastPlanHash: null,
  };
  const events: string[] = [];
  const decision: DiscussionInventoryDecision = {
    kind,
    nodeId,
    ownerIdentityId: 'owner',
    tenantId: 'default',
    erasureRevision: null,
    reason: null,
  };
  const repository: jest.Mocked<DiscussionPayloadInventoryRepository> = {
    exclusive: jest
      .fn()
      .mockImplementation(async (work: () => Promise<unknown>) => work()),
    progress: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['progress']>,
      Parameters<DiscussionPayloadInventoryRepository['progress']>
    >(async () => ({ ...progress })),
    classify: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['classify']>,
      Parameters<DiscussionPayloadInventoryRepository['classify']>
    >(async () => ({ ...decision })),
    adopt: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['adopt']>,
      Parameters<DiscussionPayloadInventoryRepository['adopt']>
    >(async () => {
      events.push('adopt');
    }),
    prepareCopy: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['prepareCopy']>,
      Parameters<DiscussionPayloadInventoryRepository['prepareCopy']>
    >(async () => {
      events.push('reserve');
    }),
    confirmCopy: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['confirmCopy']>,
      Parameters<DiscussionPayloadInventoryRepository['confirmCopy']>
    >(async () => {
      events.push('confirm');
    }),
    retire: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['retire']>,
      Parameters<DiscussionPayloadInventoryRepository['retire']>
    >(async (_item, write) => {
      events.push('locks');
      await write();
    }),
    advance: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['advance']>,
      Parameters<DiscussionPayloadInventoryRepository['advance']>
    >(async (previous, after) => {
      events.push('advance');
      return (progress = {
        ...previous,
        after,
        revision: previous.revision + 1,
      });
    }),
    finish: jest.fn<
      ReturnType<DiscussionPayloadInventoryRepository['finish']>,
      Parameters<DiscussionPayloadInventoryRepository['finish']>
    >(async (previous, fingerprint, complete) => {
      events.push('finish');
      return (progress = {
        ...previous,
        revision: previous.revision + 1,
        lastPlanHash: fingerprint,
        legacyWritersStoppedAt: 100,
        completedAt: complete ? 100 : null,
      });
    }),
  };
  const objects: jest.Mocked<DiscussionPayloadInventoryObjects> = {
    requireUnversioned: jest.fn<
      ReturnType<DiscussionPayloadInventoryObjects['requireUnversioned']>,
      Parameters<DiscussionPayloadInventoryObjects['requireUnversioned']>
    >(async () => undefined),
    page: jest.fn<
      ReturnType<DiscussionPayloadInventoryObjects['page']>,
      Parameters<DiscussionPayloadInventoryObjects['page']>
    >(async () => ({
      objects: [
        {
          key: kind === 'copy-legacy' ? legacy : key,
          bytes: body.length,
          etag: 'generation',
        },
      ],
      more: false,
    })),
    read: jest.fn<
      ReturnType<DiscussionPayloadInventoryObjects['read']>,
      Parameters<DiscussionPayloadInventoryObjects['read']>
    >(async () => ({ body, retired: false })),
    copy: jest.fn<
      ReturnType<DiscussionPayloadInventoryObjects['copy']>,
      Parameters<DiscussionPayloadInventoryObjects['copy']>
    >(async () => {
      events.push('put');
    }),
    retire: jest.fn<
      ReturnType<DiscussionPayloadInventoryObjects['retire']>,
      Parameters<DiscussionPayloadInventoryObjects['retire']>
    >(async () => {
      events.push('marker');
    }),
  };
  return {
    repository,
    objects,
    events,
    decision,
    inventory: new InventoryDiscussionPayloads(repository, objects),
  };
}

describe('historical Discussion payload inventory', () => {
  it('plans without modifying authority or storage', async () => {
    const { inventory, repository, objects } = fixture();
    const plan = await inventory.plan();
    expect(plan.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.items[0].decision.kind).toBe('adopt');
    expect(repository.exclusive).not.toHaveBeenCalled();
    expect(objects.read).not.toHaveBeenCalled();
    expect(repository.adopt).not.toHaveBeenCalled();
  });
  it('adopts verified bytes before advancing its cursor and supports exact batch replay', async () => {
    const { inventory, repository, events } = fixture();
    const plan = await inventory.plan();
    const result = await inventory.apply(plan.fingerprint, true);
    expect(repository.adopt).toHaveBeenCalledWith(plan.items[0], {
      key,
      bytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
    });
    expect(events).toEqual(['adopt', 'advance', 'finish']);
    expect(result.completedAt).toBe(100);
    expect(await inventory.apply(plan.fingerprint, true)).toEqual(result);
    expect(repository.adopt).toHaveBeenCalledTimes(1);
  });
  it('durably reserves and confirms a deterministic immutable copy before retiring legacy bytes', async () => {
    const { inventory, repository, events } = fixture('copy-legacy');
    await inventory.apply((await inventory.plan()).fingerprint, true);
    expect(events).toEqual([
      'reserve',
      'put',
      'confirm',
      'locks',
      'marker',
      'advance',
      'finish',
    ]);
    const reference = repository.prepareCopy.mock.calls[0][1];
    expect(discussionInventoryKey(reference.key)).toEqual({
      nodeId,
      legacy: false,
    });
    expect(repository.confirmCopy.mock.calls[0][1]).toEqual(reference);
    expect(repository.retire.mock.calls[0][2]).toEqual(reference);
  });
  it.each(['copy', 'confirmCopy'] as const)(
    'preserves legacy bytes and progress after %s failure',
    async (failure) => {
      const { inventory, repository, objects } = fixture('copy-legacy');
      (failure === 'copy'
        ? objects.copy
        : repository.confirmCopy
      ).mockRejectedValue(new Error('interrupted'));
      await expect(
        inventory.apply((await inventory.plan()).fingerprint, true)
      ).rejects.toThrow('interrupted');
      expect(objects.retire).not.toHaveBeenCalled();
      expect(repository.advance).not.toHaveBeenCalled();
      expect(repository.finish).not.toHaveBeenCalled();
    }
  );
  it.each(['etag', 'authority', 'checkpoint'] as const)(
    'rejects a plan after %s drift',
    async (change) => {
      const { inventory, repository, objects, decision } = fixture();
      const plan = await inventory.plan();
      if (change === 'etag')
        objects.page.mockResolvedValue({
          objects: [{ key, bytes: body.length, etag: 'new' }],
          more: false,
        });
      if (change === 'authority') decision.ownerIdentityId = 'other';
      if (change === 'checkpoint')
        repository.progress.mockResolvedValue({
          ...plan.progress,
          revision: 2,
        });
      await expect(inventory.apply(plan.fingerprint, true)).rejects.toThrow(
        'changed'
      );
      expect(repository.adopt).not.toHaveBeenCalled();
    }
  );
  it('does not advance beyond unresolved ownership or claim overall completion', async () => {
    const { inventory, repository, objects } = fixture('blocked');
    await expect(
      inventory.apply((await inventory.plan()).fingerprint, true)
    ).rejects.toThrow('blocked');
    expect(repository.advance).not.toHaveBeenCalled();
    expect(objects.retire).not.toHaveBeenCalled();
    expect(repository.finish).not.toHaveBeenCalled();
  });
  it('retains successful per-object progress after a later batch failure', async () => {
    const { inventory, repository, objects } = fixture('retire-orphan');
    objects.page.mockResolvedValue({
      objects: [
        { key, etag: 'one', bytes: 5 },
        { key: `${key}2`, etag: 'two', bytes: 5 },
      ],
      more: true,
    });
    objects.retire
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('unavailable'));
    const plan = await inventory.plan();
    await expect(inventory.apply(plan.fingerprint, true)).rejects.toThrow(
      'unavailable'
    );
    expect((await repository.progress()).after).toBe(key);
    expect(repository.finish).not.toHaveBeenCalled();
    await expect(inventory.apply(plan.fingerprint, true)).rejects.toThrow(
      'changed'
    );
  });
  it.each([Buffer.from('{}'), Buffer.from('invalid'), Buffer.from([0xff])])(
    'rejects corrupt historical bytes before adoption: %p',
    async (invalid) => {
      const { inventory, repository, objects } = fixture();
      objects.read.mockResolvedValue({ body: invalid, retired: false });
      await expect(
        inventory.apply((await inventory.plan()).fingerprint, true)
      ).rejects.toThrow('invalid UTF-8 or content');
      expect(repository.adopt).not.toHaveBeenCalled();
    }
  );
  it('blocks oversized owned objects without trying to read or retire them', async () => {
    const { inventory, objects } = fixture();
    objects.page.mockResolvedValue({
      objects: [
        { key, etag: 'large', bytes: DISCUSSION_MAX_PAYLOAD_BYTES + 1 },
      ],
      more: false,
    });
    const plan = await inventory.plan();
    expect(plan.items[0].decision.kind).toBe('blocked');
    await expect(inventory.apply(plan.fingerprint, true)).rejects.toThrow(
      'supported bound'
    );
    expect(objects.read).not.toHaveBeenCalled();
  });
  it('recognizes permanent retirement markers after an interrupted cursor update', async () => {
    const { inventory, repository, objects } = fixture('copy-legacy');
    objects.read.mockResolvedValue({ body: Buffer.alloc(0), retired: true });
    await inventory.apply((await inventory.plan()).fingerprint, true);
    expect(objects.copy).not.toHaveBeenCalled();
    expect(repository.advance).toHaveBeenCalled();
  });
  it('records an incomplete page without claiming the whole inventory is done', async () => {
    const { inventory, objects } = fixture('tracked');
    objects.page.mockResolvedValue({
      objects: [{ key, etag: 'known', bytes: 10 }],
      more: true,
    });
    expect(
      (await inventory.apply((await inventory.plan()).fingerprint, true))
        .completedAt
    ).toBeNull();
  });
  it('requires explicit stopped-writer acknowledgement and a valid fingerprint', async () => {
    const { inventory, repository } = fixture();
    await expect(inventory.apply('a'.repeat(64), false)).rejects.toThrow(
      'stopped legacy writers'
    );
    await expect(inventory.apply('bad', true)).rejects.toThrow(
      'reviewed fingerprint'
    );
    expect(repository.exclusive).not.toHaveBeenCalled();
  });
  it.each(['other', legacy.toUpperCase(), `${legacy}/extra`, `prefix/${key}`])(
    'does not infer ownership from unrecognized keys %s',
    (value) => {
      expect(discussionInventoryKey(value)).toBeNull();
    }
  );
});
