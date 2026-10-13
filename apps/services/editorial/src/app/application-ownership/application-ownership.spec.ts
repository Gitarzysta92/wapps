import { err, ok } from '@sdk/kernel/standard';
import {
  ApplicationOwnership,
  assertOwnershipClaimAccess,
  type ApplicationOwnershipStore,
} from './application-ownership';
import {
  OWNERSHIP_CHALLENGE_LIFETIME,
  type OwnershipClaim,
} from '@domains/catalog/ownership';
import { DnsOwnershipProof } from './dns-ownership-proof';

const actor = { identityId: 'Claimant', tenantId: 'default', roles: [] };
const id = '019a0010-0000-7000-8000-000000000001';
const random = { id: () => id, token: () => 'a'.repeat(64) };
const claim: OwnershipClaim = {
  id,
  applicationId: '019a0010-0000-7000-8000-000000000002',
  claimantIdentityId: actor.identityId,
  revision: 1,
  applicationRevision: 2,
  applicationName: 'An Application',
  applicationSlug: 'an-application',
  website: 'https://example.test',
  hostname: 'example.test',
  evidenceUrl: 'https://example.test/team',
  notes: 'I maintain this application and its official website.',
  challengeName: '_wapps-ownership.example.test',
  challengeValue: 'wapps-ownership=' + random.token(),
  status: 'awaiting-proof',
  createdAt: 1000,
  updatedAt: 1000,
  expiresAt: 1000 + OWNERSHIP_CHALLENGE_LIFETIME,
  verifiedAt: null,
  reviewedAt: null,
  reason: '',
};
describe('ownership application boundary', () => {
  const store: jest.Mocked<ApplicationOwnershipStore> = {
    list: jest.fn(),
    read: jest.fn(),
    create: jest.fn(),
    change: jest.fn(),
    reserveCheck: jest.fn(),
    finishCheck: jest.fn(),
  };
  const proof = { matches: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it.each([
    'verify',
    'approve',
    'reject',
    'cancel',
    'release',
    'revoke',
  ] as const)('denies %s before DNS or persistence', async (action) => {
    const service = new ApplicationOwnership(
      store,
      proof,
      { evaluate: async () => ok(false) },
      random
    );
    await expect(
      service.change(actor, id, action, { expectedRevision: 1 }, 'key')
    ).rejects.toThrow();
    expect(store.change).not.toHaveBeenCalled();
    expect(store.reserveCheck).not.toHaveBeenCalled();
    expect(proof.matches).not.toHaveBeenCalled();
  });
  it('fails closed for private/reviewer reads, create and policy outage', async () => {
    const service = new ApplicationOwnership(
      store,
      proof,
      { evaluate: async () => err(new Error('offline')) },
      random
    );
    await expect(service.create(actor, {}, 'key')).rejects.toThrow(
      'authorization'
    );
    await expect(service.read(actor, id, true)).rejects.toThrow(
      'authorization'
    );
    await expect(service.list(actor, false, 1)).rejects.toThrow(
      'authorization'
    );
    expect(store.read).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.list).not.toHaveBeenCalled();
  });
  it('uses only the reserved canonical challenge and fences completion with its lease', async () => {
    store.reserveCheck.mockResolvedValue({ claim, lease: 'lease' });
    proof.matches.mockResolvedValue(true);
    const service = new ApplicationOwnership(
      store,
      proof,
      { evaluate: async () => ok(true) },
      random,
      () => 2000
    );
    await service.change(actor, id, 'verify', { expectedRevision: 1 }, 'key');
    expect(proof.matches).toHaveBeenCalledWith(
      claim.challengeName,
      claim.challengeValue
    );
    expect(store.finishCheck).toHaveBeenCalledWith(
      expect.objectContaining({ id, key: 'key', action: 'verify' }),
      'lease',
      true,
      2000
    );
  });
  it('does not repeat DNS for a completed idempotent verification', async () => {
    const receipt = {
      id,
      revision: 2,
      action: 'verify' as const,
      status: 'awaiting-review' as const,
      proofMatched: true,
      applicationRevision: null,
    };
    store.reserveCheck.mockResolvedValue({ receipt });
    const service = new ApplicationOwnership(
      store,
      proof,
      { evaluate: async () => ok(true) },
      random
    );
    await expect(
      service.change(actor, id, 'verify', { expectedRevision: 1 }, 'key')
    ).resolves.toEqual(receipt);
    expect(proof.matches).not.toHaveBeenCalled();
    expect(store.finishCheck).not.toHaveBeenCalled();
  });
  it('keeps a failed DNS operation recoverable without claiming successful proof', async () => {
    store.reserveCheck.mockResolvedValue({ claim, lease: 'lease' });
    proof.matches.mockRejectedValue(new Error('DNS offline'));
    const service = new ApplicationOwnership(
      store,
      proof,
      { evaluate: async () => ok(true) },
      random
    );
    await expect(
      service.change(actor, id, 'verify', { expectedRevision: 1 }, 'key')
    ).rejects.toThrow('Domain verification is unavailable');
    expect(store.finishCheck).not.toHaveBeenCalled();
  });
  it('rejects self-review, cross-owner and cross-tenant access even for administrators', () => {
    expect(() =>
      assertOwnershipClaimAccess(
        { ...actor, roles: ['admin'] },
        'default',
        actor.identityId,
        true
      )
    ).toThrow();
    expect(() =>
      assertOwnershipClaimAccess(actor, 'other', actor.identityId, false)
    ).toThrow();
    expect(() =>
      assertOwnershipClaimAccess(actor, 'default', 'Other', false)
    ).toThrow();
  });
  it('requests dedicated ownership review permission independently from content review', async () => {
    const policy = { evaluate: jest.fn(async () => ok(true)) };
    const service = new ApplicationOwnership(store, proof, policy, random);
    await service.change(actor, id, 'approve', { expectedRevision: 2 }, 'key');
    expect(policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.ownership.review',
        resource: { type: 'ownership-review', id, tenantId: 'default' },
      })
    );
  });
  it('requires staff review policy for active grants and rejects grants on the self list', async () => {
    const policy = { evaluate: jest.fn(async () => ok(true)) };
    const service = new ApplicationOwnership(store, proof, policy, random);
    await service.list(actor, true, 2, true);
    expect(policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.ownership.review',
        resource: {
          type: 'ownership-review',
          id: actor.identityId,
          tenantId: actor.tenantId,
        },
      })
    );
    expect(store.list).toHaveBeenCalledWith(actor, true, 2, true);
    store.list.mockClear();
    await expect(service.list(actor, false, 1, true)).rejects.toThrow(
      'Invalid ownership page'
    );
    policy.evaluate.mockResolvedValue(ok(false));
    await expect(service.list(actor, true, 1, true)).rejects.toThrow();
    expect(store.list).not.toHaveBeenCalled();
  });
});
describe('bounded ownership DNS adapter', () => {
  it('validates explicit resolver configuration at composition time', () => {
    expect(DnsOwnershipProof.configured()).toBeInstanceOf(DnsOwnershipProof);
    expect(DnsOwnershipProof.configured('127.0.0.1:5353')).toBeInstanceOf(
      DnsOwnershipProof
    );
    for (const value of [
      '',
      '127.0.0.1,',
      'https://dns.example.test',
      '127.0.0.1,'.repeat(5),
    ])
      expect(() => DnsOwnershipProof.configured(value)).toThrow();
  });
  it('joins TXT chunks but requires the entire exact challenge value', async () => {
    const resolver = {
      resolveTxt: jest.fn(async () => [['wapps-ownership=', 'a'.repeat(64)]]),
      cancel: jest.fn(),
    };
    const proof = new DnsOwnershipProof(() => resolver);
    await expect(
      proof.matches(claim.challengeName, claim.challengeValue)
    ).resolves.toBe(true);
    resolver.resolveTxt.mockResolvedValue([[claim.challengeValue + '-suffix']]);
    await expect(
      proof.matches(claim.challengeName, claim.challengeValue)
    ).resolves.toBe(false);
  });
  it.each(['ENODATA', 'ENOTFOUND'])(
    'distinguishes missing proof (%s) from provider failure',
    async (code) => {
      const proof = new DnsOwnershipProof(() => ({
        resolveTxt: async () => {
          throw { code };
        },
        cancel: jest.fn(),
      }));
      await expect(
        proof.matches(claim.challengeName, claim.challengeValue)
      ).resolves.toBe(false);
    }
  );
  it.each(['ESERVFAIL', 'ETIMEOUT', 'ECONNREFUSED'])(
    'reports %s without recording negative or successful proof',
    async (code) => {
      const proof = new DnsOwnershipProof(() => ({
        resolveTxt: async () => {
          throw { code };
        },
        cancel: jest.fn(),
      }));
      await expect(
        proof.matches(claim.challengeName, claim.challengeValue)
      ).rejects.toThrow('unavailable');
    }
  );
  it('cancels a hung resolver after the bound and rejects oversized answers', async () => {
    jest.useFakeTimers();
    try {
      const resolver = {
        resolveTxt: jest.fn(() => new Promise<string[][]>(() => undefined)),
        cancel: jest.fn(),
      };
      const proof = new DnsOwnershipProof(() => resolver);
      const expectation = expect(
        proof.matches(claim.challengeName, claim.challengeValue)
      ).rejects.toThrow('timed out');
      await jest.advanceTimersByTimeAsync(5000);
      await expectation;
      expect(resolver.cancel).toHaveBeenCalledTimes(1);
      resolver.resolveTxt.mockResolvedValue(new Array(65).fill(['short']));
      await expect(
        proof.matches(claim.challengeName, claim.challengeValue)
      ).rejects.toThrow('size');
    } finally {
      jest.useRealTimers();
    }
  });
});
