import {
  assertOwnershipTransition,
  OWNERSHIP_CHALLENGE_LIFETIME,
  OWNERSHIP_PROOF_FRESHNESS,
  ownershipHostname,
  parseOwnershipChangeInput,
  parseOwnershipClaim,
  parseOwnershipClaimInput,
  parseOwnershipPage,
  parseOwnershipReceipt,
  type OwnershipClaim,
} from './application-ownership';

const claim: OwnershipClaim = {
  id: '019a0010-0000-7000-8000-000000000001',
  applicationId: '019a0010-0000-7000-8000-000000000002',
  claimantIdentityId: 'Claimant',
  revision: 1,
  applicationRevision: 3,
  applicationName: 'An Application',
  applicationSlug: 'an-application',
  website: 'https://www.example.test/app',
  hostname: 'www.example.test',
  evidenceUrl: 'https://www.example.test/team',
  notes: 'I maintain this application and control its website.',
  challengeName: '_wapps-ownership.www.example.test',
  challengeValue: 'wapps-ownership=' + 'a'.repeat(64),
  status: 'awaiting-proof',
  createdAt: 1000,
  updatedAt: 1000,
  expiresAt: 1000 + OWNERSHIP_CHALLENGE_LIFETIME,
  verifiedAt: null,
  reviewedAt: null,
  reason: '',
};
const ready = {
  ...claim,
  revision: 2,
  status: 'awaiting-review' as const,
  verifiedAt: 2000,
  updatedAt: 2000,
};

describe('application ownership invariants', () => {
  it('binds proof to the exact canonical host without parent-domain fallback', () => {
    expect(ownershipHostname('https://WWW.Example.test/path?q=1')).toBe(
      'www.example.test'
    );
    expect(parseOwnershipClaim(claim)).toEqual(claim);
    expect(() =>
      parseOwnershipClaim({ ...claim, hostname: 'example.test' })
    ).toThrow();
    expect(() =>
      parseOwnershipClaim({
        ...claim,
        challengeName: '_wapps-ownership.example.test',
      })
    ).toThrow();
  });
  it.each([
    'http://127.0.0.1',
    'http://2130706433',
    'http://[::1]',
    'http://localhost',
    'https://app.local',
    'https://user:password@example.test',
    'javascript:alert(1)',
  ])('rejects unsupported canonical website %s', (website) =>
    expect(() => ownershipHostname(website)).toThrow()
  );
  it('rejects client-chosen proof, reviewer or ownership status', () => {
    const input = {
      applicationId: claim.applicationId,
      evidenceUrl: claim.evidenceUrl,
      notes: claim.notes,
    };
    expect(parseOwnershipClaimInput(input)).toEqual(input);
    for (const extra of [
      { hostname: 'attacker.test' },
      { status: 'approved' },
      { claimantIdentityId: 'SomeoneElse' },
    ])
      expect(() => parseOwnershipClaimInput({ ...input, ...extra })).toThrow();
  });
  it('requires proof and a fresh unchanged canonical revision before approval', () => {
    expect(() =>
      assertOwnershipTransition(
        'approve',
        claim,
        { expectedRevision: 1, reason: '' },
        2000,
        3
      )
    ).toThrow('proof');
    expect(() =>
      assertOwnershipTransition(
        'approve',
        ready,
        { expectedRevision: 2, reason: '' },
        3000,
        3
      )
    ).not.toThrow();
    expect(() =>
      assertOwnershipTransition(
        'approve',
        ready,
        { expectedRevision: 2, reason: '' },
        3000,
        4
      )
    ).toThrow('application changed');
    expect(() =>
      assertOwnershipTransition(
        'approve',
        ready,
        { expectedRevision: 2, reason: '' },
        2001 + OWNERSHIP_PROOF_FRESHNESS,
        3
      )
    ).toThrow('Fresh domain proof');
  });
  it('expires proof verification without preventing rejection or cancellation', () => {
    expect(() =>
      assertOwnershipTransition(
        'verify',
        claim,
        { expectedRevision: 1, reason: '' },
        claim.expiresAt,
        3
      )
    ).toThrow('expired');
    expect(() =>
      assertOwnershipTransition(
        'cancel',
        claim,
        { expectedRevision: 1, reason: '' },
        claim.expiresAt,
        4
      )
    ).not.toThrow();
    expect(() =>
      assertOwnershipTransition(
        'reject',
        claim,
        { expectedRevision: 1, reason: 'Not the maintainer' },
        claim.expiresAt,
        4
      )
    ).not.toThrow();
  });
  it('rejects stale revisions, completed claims and empty decisions', () => {
    expect(() =>
      assertOwnershipTransition(
        'verify',
        claim,
        { expectedRevision: 2, reason: '' },
        2000,
        3
      )
    ).toThrow('claim changed');
    expect(() =>
      assertOwnershipTransition(
        'cancel',
        { ...ready, status: 'approved', reviewedAt: 3000 },
        { expectedRevision: 2, reason: '' },
        4000,
        4
      )
    ).toThrow();
    expect(() =>
      parseOwnershipChangeInput('reject', { expectedRevision: 1, reason: ' ' })
    ).toThrow();
    expect(() =>
      parseOwnershipChangeInput('verify', {
        expectedRevision: 1,
        proofMatched: true,
      })
    ).toThrow();
  });
  it('rejects corrupted proof/lifecycle timestamps and contradictory receipts', () => {
    for (const change of [
      { status: 'approved' },
      { verifiedAt: 500 },
      { challengeValue: 'guessable' },
      { expiresAt: 2000 },
      { claimantIdentityId: ' Claimant' },
    ])
      expect(() => parseOwnershipClaim({ ...claim, ...change })).toThrow();
    const receipt = {
      id: claim.id,
      revision: 3,
      action: 'approve',
      status: 'approved',
      proofMatched: null,
      applicationRevision: 4,
    };
    expect(parseOwnershipReceipt(receipt)).toEqual(receipt);
    expect(() =>
      parseOwnershipReceipt({ ...receipt, applicationRevision: null })
    ).toThrow();
    expect(() =>
      parseOwnershipReceipt({ ...receipt, status: 'awaiting-review' })
    ).toThrow();
    expect(() =>
      parseOwnershipReceipt({
        ...receipt,
        action: 'verify',
        proofMatched: true,
      })
    ).toThrow();
  });
  it('bounds private/reviewer pages and rejects duplicate claims', () => {
    expect(
      parseOwnershipPage({ items: [claim], total: 1, page: 1 }).items
    ).toEqual([claim]);
    expect(() =>
      parseOwnershipPage({ items: [claim, claim], total: 2, page: 1 })
    ).toThrow();
    expect(() =>
      parseOwnershipPage({ items: [], total: 0, page: 10001 })
    ).toThrow();
  });
});
