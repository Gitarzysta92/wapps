import { ok } from '@sdk/kernel/standard';
import { ProfileDiscussionTotals } from './profile-totals';
const id = 'b96a5238-d11b-422b-ae19-447880a0db8a';
function setup() {
  const groups = [{ target: { kind: 'application' as const, id }, total: 32 }];
  const index = { read: jest.fn().mockResolvedValue(groups) };
  const parents = {
    select: jest
      .fn()
      .mockResolvedValue([
        { target: groups[0].target, title: 'App', slug: 'app' },
      ]),
  };
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  return {
    index,
    parents,
    policy,
    service: new ProfileDiscussionTotals(index, parents, policy, 'default'),
  };
}
const actor = {
  identityId: 'wapps-profile-reader',
  tenantId: 'default',
  roles: ['discussion:profile-reader'],
};
const input = { ownerIdentityId: 'owner', categories: ['discussions'] };
describe('discussion profile totals', () => {
  it('counts distinct-thread totals beyond a page', async () =>
    expect(await setup().service.read(input, actor)).toEqual({
      discussions: 32,
    }));
  it('excludes withdrawn parents', async () => {
    const f = setup();
    f.parents.select.mockResolvedValue([]);
    expect(await f.service.read(input, actor)).toEqual({ discussions: 0 });
  });
  it('rejects lost contributions during parent reads', async () => {
    const f = setup();
    f.index.read
      .mockResolvedValueOnce([
        { target: { kind: 'application', id }, total: 32 },
      ])
      .mockResolvedValueOnce([]);
    await expect(f.service.read(input, actor)).rejects.toThrow('changed');
  });
  it('bounds unique parents and rejects duplicates', async () => {
    const f = setup();
    f.index.read.mockResolvedValue(
      Array(201).fill({ target: { kind: 'application', id }, total: 1 })
    );
    await expect(f.service.read(input, actor)).rejects.toThrow('bounds');
  });
  it('denies ordinary or cross-tenant callers before SQL', async () => {
    const f = setup();
    await expect(
      f.service.read(input, { ...actor, identityId: 'owner' })
    ).rejects.toThrow();
    await expect(
      f.service.read(input, { ...actor, tenantId: 'other' })
    ).rejects.toThrow();
    expect(f.index.read).not.toHaveBeenCalled();
  });
  it('enforces policy denial and strict scope', async () => {
    const f = setup();
    f.policy.evaluate.mockResolvedValue(ok(false));
    await expect(f.service.read(input, actor)).rejects.toThrow();
    await expect(
      f.service.read({ ...input, tenantId: 'other' }, actor)
    ).rejects.toThrow();
    expect(f.index.read).not.toHaveBeenCalled();
  });
  it('fails truthfully when parent resolution fails', async () => {
    const f = setup();
    f.parents.select.mockRejectedValue(new Error('unavailable'));
    await expect(f.service.read(input, actor)).rejects.toThrow('unavailable');
  });
});
