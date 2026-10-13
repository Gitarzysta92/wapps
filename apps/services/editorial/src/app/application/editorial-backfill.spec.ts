import {
  appSnapshot,
  editorialId,
} from '../../testing/editorial-projection-fixtures';
import {
  EditorialBackfillSource,
  EditorialLegacyBackfill,
  EditorialOwnershipManifest,
  parseEditorialOwnershipManifest,
} from './editorial-backfill';

const manifest: EditorialOwnershipManifest = {
  version: 1,
  kind: 'app',
  resourceId: editorialId(),
  tenantId: 'default',
  ownerIdentityId: 'verified-owner',
};

function fixture() {
  const source: jest.Mocked<EditorialBackfillSource> = {
    read: jest.fn().mockResolvedValue(appSnapshot()),
    receipt: jest.fn().mockResolvedValue(null),
    commit: jest.fn(),
  };
  source.commit.mockImplementation(async (plan) => ({
    kind: plan.manifest.kind,
    resourceId: plan.manifest.resourceId,
    manifestFingerprint: plan.manifestFingerprint,
    sourceFingerprint: plan.sourceFingerprint,
    fingerprint: plan.fingerprint,
    revision: 1,
  }));
  return { source, backfill: new EditorialLegacyBackfill(source) };
}

describe('Verified Editorial ownership backfill', () => {
  it('plans without writes and binds the exact source and verified owner mapping', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    expect(plan.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (
        await f.backfill.plan({
          ownerIdentityId: 'verified-owner',
          tenantId: 'default',
          resourceId: editorialId(),
          kind: 'app',
          version: 1,
        })
      ).fingerprint
    ).toBe(plan.fingerprint);
    const other = await f.backfill.plan({
      ...manifest,
      ownerIdentityId: 'another-owner',
    });
    expect(other.fingerprint).not.toBe(plan.fingerprint);
    expect(other.sourceFingerprint).toBe(plan.sourceFingerprint);
    expect(f.source.commit).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    {},
    { ...manifest, version: 2 },
    { ...manifest, kind: 'unknown' },
    { ...manifest, resourceId: 'invalid' },
    { ...manifest, ownerIdentityId: '' },
    { ...manifest, tenantId: ' default' },
    { ...manifest, ownerIdentityId: 'injected\nowner' },
    { ...manifest, author: 'untrusted' },
  ])(
    'refuses malformed or ambiguous mappings before any store access %#',
    async (input) => {
      const f = fixture();
      await expect(f.backfill.plan(input)).rejects.toThrow();
      expect(f.source.read).not.toHaveBeenCalled();
    }
  );

  it('requires both the reviewed fingerprint and an acknowledged legacy maintenance window', async () => {
    const f = fixture();
    await expect(f.backfill.apply(manifest, 'bad', true)).rejects.toThrow(
      'requires'
    );
    await expect(
      f.backfill.apply(manifest, 'a'.repeat(64), false)
    ).rejects.toThrow('requires');
    expect(f.source.receipt).not.toHaveBeenCalled();
    expect(f.source.read).not.toHaveBeenCalled();
  });

  it('rejects source drift before entering the commit adapter', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    const snapshot = appSnapshot();
    f.source.read.mockResolvedValue({
      ...snapshot,
      content: snapshot.content
        ? { ...snapshot.content, name: 'Changed' }
        : null,
    });
    await expect(
      f.backfill.apply(manifest, plan.fingerprint, true)
    ).rejects.toThrow('source changed');
    expect(f.source.commit).not.toHaveBeenCalled();
  });

  it('commits the reviewed source and converges a retry without resetting later mutations', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    const receipt = await f.backfill.apply(manifest, plan.fingerprint, true);
    expect(f.source.commit).toHaveBeenCalledWith(plan);
    f.source.receipt.mockResolvedValue(receipt);
    f.source.read.mockRejectedValue(new Error('Already versioned'));
    expect(await f.backfill.apply(manifest, plan.fingerprint, true)).toEqual(
      receipt
    );
    expect(f.source.commit).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a receipt for a different owner or reviewed source', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    const receipt = await f.backfill.apply(manifest, plan.fingerprint, true);
    f.source.receipt.mockResolvedValue(receipt);
    await expect(
      f.backfill.apply(
        { ...manifest, ownerIdentityId: 'intruder' },
        plan.fingerprint,
        true
      )
    ).rejects.toThrow('different reviewed plan');
    await expect(
      f.backfill.apply(manifest, 'b'.repeat(64), true)
    ).rejects.toThrow('different reviewed plan');
    expect(f.source.commit).toHaveBeenCalledTimes(1);
  });

  it.each([
    { revision: 2 },
    { tenantId: 'another' },
    { resourceId: editorialId(2) },
    { deletedAt: 10, content: null },
  ])(
    'rejects a mismatched or already-versioned legacy snapshot %#',
    async (change) => {
      const f = fixture();
      f.source.read.mockResolvedValue(appSnapshot(change));
      await expect(f.backfill.plan(manifest)).rejects.toThrow('does not match');
    }
  );

  it('does not mutate the caller-owned manifest while canonicalizing it', () => {
    const frozen = Object.freeze({ ...manifest });
    expect(parseEditorialOwnershipManifest(frozen)).toEqual(frozen);
  });

  it('rejects inconsistent receipt fingerprints and mismatched commit outcomes', async () => {
    const f = fixture();
    const plan = await f.backfill.plan(manifest);
    const receipt = await f.backfill.apply(manifest, plan.fingerprint, true);
    f.source.receipt.mockResolvedValue({
      ...receipt,
      sourceFingerprint: 'b'.repeat(64),
    });
    await expect(
      f.backfill.apply(manifest, plan.fingerprint, true)
    ).rejects.toThrow('different reviewed plan');
    f.source.receipt.mockResolvedValue(null);
    f.source.commit.mockResolvedValue({
      ...receipt,
      resourceId: editorialId(2),
    });
    await expect(
      f.backfill.apply(manifest, plan.fingerprint, true)
    ).rejects.toThrow('different reviewed plan');
  });
});
