import { err, ok } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityUnavailable,
  type AccountErasureReceipt,
} from '@sdk/features/identity/core';
import {
  AccountErasureAccess,
  RequestAccountErasure,
  type AccountErasureParticipant,
} from './account-erasure';

describe('cross-service account erasure', () => {
  const request = { identityId: 'Member', revision: 7 };
  const actor = {
    identityId: 'wapps-account-erasure-writer',
    tenantId: 'account-erasure',
    roles: ['account-erasure:writer'],
  };
  function participant(
    name: AccountErasureParticipant['name'],
    state: AccountErasureReceipt['state'] = 'completed'
  ) {
    return {
      name,
      request: jest
        .fn()
        .mockResolvedValue({ ...request, participant: name, state }),
    };
  }
  it('requires every owning service exactly once', () => {
    expect(() => new RequestAccountErasure([])).toThrow('all owning services');
    expect(
      () =>
        new RequestAccountErasure([
          participant('account'),
          participant('editorial'),
          participant('editorial'),
        ])
    ).toThrow();
  });
  it('completes only when every matching receipt is completed', async () => {
    const sources = [
      participant('account'),
      participant('editorial'),
      participant('discussion', 'pending'),
    ];
    const coordinator = new RequestAccountErasure(sources);
    expect(await coordinator.request(request)).toBe('pending');
    sources[2].request.mockResolvedValue({
      ...request,
      participant: 'discussion',
      state: 'completed',
    });
    expect(await coordinator.request(request)).toBe('completed');
  });
  it('still requests available services when one fails', async () => {
    const sources = [
      participant('account'),
      participant('editorial'),
      participant('discussion'),
    ];
    sources[0].request.mockRejectedValue(new Error('offline'));
    await expect(
      new RequestAccountErasure(sources).request(request)
    ).rejects.toBeInstanceOf(CanonicalIdentityUnavailable);
    for (const source of sources)
      expect(source.request).toHaveBeenCalledWith(request);
  });
  it.each([
    { identityId: 'member' },
    { revision: 8 },
    { participant: 'account' },
    { state: 'accepted' },
    { extra: true },
  ])('rejects a misleading receipt: %j', async (change) => {
    const editorial = participant('editorial');
    editorial.request.mockResolvedValue({
      ...request,
      participant: 'editorial',
      state: 'completed',
      ...change,
    });
    await expect(
      new RequestAccountErasure([
        participant('account'),
        editorial,
        participant('discussion'),
      ]).request(request)
    ).rejects.toBeInstanceOf(CanonicalIdentityUnavailable);
  });
  it.each([
    { identityId: 'Member' },
    { tenantId: 'default' },
    { roles: ['admin'] },
    { roles: ['account-export:reader'] },
    { roles: ['account-erasure:writer', 'admin'] },
  ])(
    'rejects non-service authority before policy or storage: %j',
    async (change) => {
      const source = participant('editorial'),
        evaluate = jest.fn();
      await expect(
        new AccountErasureAccess(source, { evaluate }).request(request, {
          ...actor,
          ...change,
        })
      ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
      expect(evaluate).not.toHaveBeenCalled();
      expect(source.request).not.toHaveBeenCalled();
    }
  );
  it('distinguishes policy denial and outage and never writes in either case', async () => {
    const source = participant('discussion'),
      evaluate = jest.fn().mockResolvedValue(ok(false));
    const access = new AccountErasureAccess(source, { evaluate });
    await expect(access.request(request, actor)).rejects.toBeInstanceOf(
      CanonicalIdentityAccessDenied
    );
    evaluate.mockResolvedValue(err(new Error('offline')));
    await expect(access.request(request, actor)).rejects.toBeInstanceOf(
      CanonicalIdentityUnavailable
    );
    expect(source.request).not.toHaveBeenCalled();
  });
  it('uses dedicated policy and returns the durable receipt', async () => {
    const source = participant('discussion', 'pending'),
      evaluate = jest.fn().mockResolvedValue(ok(true));
    expect(
      await new AccountErasureAccess(source, { evaluate }).request(
        request,
        actor
      )
    ).toEqual({ ...request, participant: 'discussion', state: 'pending' });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'discussion.account-erasure.request',
        resource: {
          type: 'account-erasure',
          id: 'Member',
          tenantId: 'account-erasure',
        },
      })
    );
  });
  it('does not expose local Account erasure as a remote participant', () => {
    expect(
      () =>
        new AccountErasureAccess(participant('account'), {
          evaluate: jest.fn(),
        })
    ).toThrow('not remotely writable');
  });
});
