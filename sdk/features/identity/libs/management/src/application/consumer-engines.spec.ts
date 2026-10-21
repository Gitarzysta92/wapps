import {
  consumerBindingKey,
  consumerProviderPlan,
  parseAccountExportArtifact,
} from '@sdk/features/identity/core';
import { RequestAccountErasure } from './account-erasure';
import { CompleteAccountExport } from './complete-account-export';
import {
  DeliverNotifications,
  type NotificationBinding,
} from './notification-inbox';
import {
  ChangeSavedAssociation,
  DeliverWatchedUpdates,
  type SavedAssociationBinding,
  type WatchedState,
} from './saved-associations';

const key = 'Tenant-A:Invoice/Revision-71';
const binding: SavedAssociationBinding<string, { label: string }> = {
  key: consumerBindingKey,
  state: (input) => {
    const state = input as WatchedState<string, { label: string }>;
    consumerBindingKey(state.target);
    if (!Number.isSafeInteger(state.version) || state.version < 1)
      throw new Error('Invalid source');
    return state;
  },
};
const state = {
  target: key,
  version: 3,
  at: 100,
  content: { label: 'Invoice' },
};

it('saves and watches an unknown binding with no product kind registry', async () => {
  const store = {
    inspectChange: jest.fn().mockResolvedValue(null),
    change: jest.fn().mockResolvedValue({ revision: 8 }),
  };
  const source = { read: jest.fn().mockResolvedValue(state) };
  const available = jest.fn().mockResolvedValue(true);
  const service = new ChangeSavedAssociation(store, available, source, binding);
  const change = { target: key, saved: true, expectedRevision: 7 };
  expect(await service.change('Owner', change, 'Command')).toEqual({
    revision: 8,
  });
  expect(store.change).toHaveBeenCalledWith('Owner', change, 'Command', {
    version: 3,
    at: 100,
  });
  const lease = { target: key, token: 'lease', identityId: 'Owner' };
  const watches = {
    claim: jest.fn().mockResolvedValue(lease),
    settle: jest.fn(),
    fail: jest.fn(),
  };
  expect(
    await new DeliverWatchedUpdates(watches, source, binding).advance()
  ).toBe(true);
  expect(watches.settle).toHaveBeenCalledWith(lease, state);
});
it('does not require source access for replay or removal, and isolates exact watch keys', async () => {
  const receipt = { revision: 8 };
  const store = {
    inspectChange: jest.fn().mockResolvedValue(receipt),
    change: jest.fn().mockResolvedValue(receipt),
  };
  const source = { read: jest.fn().mockRejectedValue(new Error('offline')) };
  const available = jest.fn();
  const service = new ChangeSavedAssociation(store, available, source, binding);
  const change = { target: key, saved: true, expectedRevision: 7 };
  expect(await service.change('Owner', change, 'Command')).toEqual(receipt);
  store.inspectChange.mockResolvedValue(null);
  expect(
    await service.change('Owner', { ...change, saved: false }, 'Remove')
  ).toEqual(receipt);
  expect(source.read).not.toHaveBeenCalled();
  expect(available).not.toHaveBeenCalled();
  available.mockResolvedValue(true);
  for (const target of [key.toLowerCase(), 'Tenant-B:Invoice/Revision-71']) {
    source.read.mockResolvedValue({ ...state, target });
    await expect(service.change('Owner', change, 'New')).rejects.toThrow(
      'unavailable'
    );
    const watches = {
      claim: jest.fn().mockResolvedValue({ target: key }),
      settle: jest.fn(),
      fail: jest.fn(),
    };
    await expect(
      new DeliverWatchedUpdates(watches, source, binding).advance()
    ).rejects.toThrow('scope');
    expect(watches.settle).not.toHaveBeenCalled();
    expect(watches.fail).toHaveBeenCalledTimes(1);
  }
  expect(store.change).toHaveBeenCalledTimes(1);
});
it('delivers arbitrary notifications only after durable receipt and rechecks the consumer key', async () => {
  const event = {
    id: 'Event-A',
    recipientId: 'Owner',
    at: 100,
    reference: key,
  };
  const target = { id: 'Event-A', reference: key, label: 'Invoice' };
  const contract: NotificationBinding<typeof event, typeof target> = {
    eventKey: (e) => e.reference,
    targetKey: (t) => t.reference,
    id: consumerBindingKey,
    cursor: () => null,
  };
  const source = {
    claim: jest.fn().mockResolvedValue({ event, token: 'Lease', until: 200 }),
    resolve: jest.fn().mockResolvedValue([target]),
    settle: jest.fn(),
  };
  const store = {
    receive: jest.fn().mockResolvedValue('delivered'),
    list: jest.fn(),
    current: jest.fn(),
    markRead: jest.fn(),
  };
  const worker = new DeliverNotifications(source, store, contract);
  source.settle.mockRejectedValueOnce(new Error('lost acknowledgement'));
  await expect(worker.advance()).rejects.toThrow('lost acknowledgement');
  expect(await worker.advance()).toBe(true);
  expect(store.receive.mock.calls).toEqual([
    [event, true],
    [event, true],
  ]);
  expect(store.receive.mock.invocationCallOrder[0]).toBeLessThan(
    source.settle.mock.invocationCallOrder[0]
  );
  source.resolve.mockResolvedValue([
    { ...target, reference: key.toLowerCase() },
  ]);
  await expect(worker.advance()).rejects.toThrow('scope');
  expect(store.receive).toHaveBeenCalledTimes(2);
  source.resolve.mockResolvedValue([]);
  expect(await worker.advance()).toBe(true);
  expect(store.receive).toHaveBeenLastCalledWith(event, false);
});
it('requires every consumer-defined erasure participant, with exact name, owner and revision receipts', async () => {
  const required = ['Remote:Storage/V9', 'Remote:Billing/V123'];
  const request = { identityId: 'Owner', revision: 8 };
  const participants = required.map((name) => ({
    name,
    request: jest
      .fn()
      .mockResolvedValue({ ...request, participant: name, state: 'completed' }),
  }));
  expect(
    () => new RequestAccountErasure([participants[0]], required)
  ).toThrow();
  expect(
    () =>
      new RequestAccountErasure([participants[0], participants[0]], required)
  ).toThrow();
  const worker = new RequestAccountErasure(participants, required);
  expect(await worker.request(request)).toBe('completed');
  participants[1].request.mockResolvedValue({
    ...request,
    participant: required[1].toLowerCase(),
    state: 'completed',
  });
  await expect(worker.request(request)).rejects.toThrow('unavailable');
  participants[0].request.mockRejectedValue(new Error('offline'));
  await expect(worker.request(request)).rejects.toThrow('unavailable');
  expect(participants[1].request).toHaveBeenCalledTimes(3);
});
it('completes exports for unknown provider keys and rejects incomplete artifacts against the configured plan', async () => {
  const required = ['External:Records/v201'];
  const sources = [
    {
      name: required[0],
      capture: async function* () {
        /* archive fixture below supplies the stream result */
      },
    },
  ];
  const artifact = {
    bytes: 10,
    chunks: 1,
    sha256: 'a'.repeat(64),
    captures: [
      { source: required[0], startedAt: 100, completedAt: 101, records: 0 },
    ],
  };
  expect(parseAccountExportArtifact(artifact, required)).toEqual(artifact);
  expect(() =>
    parseAccountExportArtifact(artifact, [...required, 'Missing'])
  ).toThrow();
  const jobs = {
    purge: jest.fn(),
    claim: jest
      .fn()
      .mockResolvedValue({
        id: 'work',
        identityId: 'Owner',
        token: 'lease',
        attempts: 1,
        expiresAt: 100000,
      }),
    heartbeat: jest.fn().mockResolvedValue(true),
    append: jest.fn(),
    complete: jest.fn().mockResolvedValue(true),
    failed: jest.fn(),
  };
  const archive = { build: jest.fn().mockResolvedValue(artifact) };
  expect(
    () =>
      new CompleteAccountExport(
        jobs,
        [],
        archive,
        () => 'lease',
        () => 100,
        required
      )
  ).toThrow();
  const worker = new CompleteAccountExport(
    jobs,
    sources,
    archive,
    () => 'lease',
    () => 100,
    required
  );
  expect(await worker.once()).toBe('completed');
  archive.build.mockResolvedValue({ ...artifact, captures: [] });
  expect(await worker.once()).toBe('failed');
  expect(jobs.complete).toHaveBeenCalledTimes(1);
  expect(jobs.failed).toHaveBeenCalledWith(
    expect.anything(),
    'invalid-source',
    100,
    true
  );
});
it('rejects empty/duplicate provider plans and snapshots a case-sensitive consumer plan', () => {
  for (const plan of [[], ['A', 'A'], [''], ['bad key']])
    expect(() => consumerProviderPlan(plan)).toThrow();
  const input = ['A', 'a'];
  const plan = consumerProviderPlan(input);
  input.pop();
  expect(plan).toEqual(['A', 'a']);
  expect(Object.isFrozen(plan)).toBe(true);
});
