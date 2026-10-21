import {
  legacyEvidenceHash,
  parseLegacyStubPlan,
  planLegacyStubs,
} from './legacy-identity-plan';

const uid = '01992000-0000-7000-8000-000000000001';
function evidence() {
  return {
    sourceDatabase: 'legacy_identity',
    capturedAt: 200,
    subjects: [
      {
        id: 'provider:external',
        provider: 'provider',
        externalId: 'external',
        identityId: uid,
        createdAt: 100,
        updatedAt: 100,
        deletedAt: 0,
      },
    ],
    nodes: [
      {
        _id: 'old-document-id',
        id: uid,
        kind: 'identity',
        createdAt: 100,
        updatedAt: 100,
        deletedAt: 0,
      },
    ],
    accounts: [
      {
        _id: uid,
        email: 'unverified@example.test',
        status: 'STUB',
        createdAt: 101,
        updatedAt: 101,
        deletedAt: 0,
      },
    ],
    profiles: [{ _id: uid, createdAt: 101, updatedAt: 101, deletedAt: 0 }],
  };
}

describe('legacy identity evidence', () => {
  it('preserves the exact internal ID and timestamps without creating a credential binding', () => {
    const plan = planLegacyStubs(evidence());
    expect(plan.policy).toBe('restricted-stubs');
    expect(plan.identities[0]).toEqual({
      identityId: uid,
      createdAt: 100,
      sourceUpdatedAt: 101,
      sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(plan)).not.toContain('unverified@example.test');
    expect(JSON.stringify(plan)).not.toContain('external');
    expect(parseLegacyStubPlan(plan)).toEqual(plan);
  });
  it('fingerprints original private evidence without interpreting email as identity', () => {
    const first = evidence(),
      second = evidence();
    second.accounts[0].email = 'different@example.test';
    expect(planLegacyStubs(first).identities[0].identityId).toBe(
      planLegacyStubs(second).identities[0].identityId
    );
    expect(planLegacyStubs(first).sourceHash).not.toBe(
      planLegacyStubs(second).sourceHash
    );
  });
  it('uses deterministic object ordering', () => {
    expect(legacyEvidenceHash({ z: 1, a: { c: 2, b: 3 } })).toBe(
      legacyEvidenceHash({ a: { b: 3, c: 2 }, z: 1 })
    );
  });
  it.each([
    [
      'missing node',
      (v: ReturnType<typeof evidence>) => {
        v.nodes = [];
      },
    ],
    [
      'duplicate profile',
      (v: ReturnType<typeof evidence>) => {
        v.profiles.push({ ...v.profiles[0] });
      },
    ],
    [
      'different identity',
      (v: ReturnType<typeof evidence>) => {
        v.accounts[0]._id = uid.replace(/1$/, '2');
      },
    ],
    [
      'deleted source',
      (v: ReturnType<typeof evidence>) => {
        v.nodes[0].deletedAt = 150;
      },
    ],
    [
      'registered account',
      (v: ReturnType<typeof evidence>) => {
        v.accounts[0].status = 'ACTIVE';
      },
    ],
    [
      'unknown lifecycle',
      (v: ReturnType<typeof evidence>) => {
        Object.assign(v.nodes[0], { isSuspended: true });
      },
    ],
    [
      'populated profile',
      (v: ReturnType<typeof evidence>) => {
        Object.assign(v.profiles[0], { name: 'Member' });
      },
    ],
    [
      'future timestamp',
      (v: ReturnType<typeof evidence>) => {
        v.subjects[0].updatedAt = 300;
      },
    ],
    [
      'reversed timestamps',
      (v: ReturnType<typeof evidence>) => {
        v.nodes[0].updatedAt = 99;
      },
    ],
    [
      'duplicate provider subject',
      (v: ReturnType<typeof evidence>) => {
        v.subjects.push({ ...v.subjects[0], id: 'another' });
      },
    ],
    [
      'unsafe schema',
      (v: ReturnType<typeof evidence>) => {
        v.sourceDatabase = 'identity`;';
      },
    ],
    [
      'overflow',
      (v: ReturnType<typeof evidence>) => {
        v.nodes = Array.from({ length: 1001 }, () => v.nodes[0]);
      },
    ],
  ])('refuses %s instead of inventing a migration', (_name, edit) => {
    const value = evidence();
    edit(value);
    expect(() => planLegacyStubs(value)).toThrow('legacy identity evidence');
  });
  it('requires a consistent source fingerprint after editing a plan', () => {
    const plan = planLegacyStubs(evidence());
    plan.identities[0].createdAt = 99;
    expect(() => parseLegacyStubPlan(plan)).toThrow('legacy identity evidence');
  });
  it('rejects active-policy and extra credential fields', () => {
    const plan = planLegacyStubs(evidence());
    expect(() => parseLegacyStubPlan({ ...plan, policy: 'active' })).toThrow();
    expect(() => parseLegacyStubPlan({ ...plan, bindings: [] })).toThrow();
  });
});
