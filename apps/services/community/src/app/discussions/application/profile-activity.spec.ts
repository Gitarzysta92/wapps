import { ok, err } from '@sdk/kernel/standard';
import { ProfileCommunityActivity } from './profile-activity';
import { DiscussionNotFoundError } from './discussion-write.port';

const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const candidate = { kind: 'reply', id: id(1), rootId: id(2), at: 100, revision: 3, target: { kind: 'application', id: id(3) } };
const actor = { identityId: 'wapps-profile-reader', tenantId: 'default', roles: ['discussion:profile-reader'] };
const request = { ownerIdentityId: 'PrivateOwner', after: null, sharing: { suites: false, discussions: true, favorites: false } };
function fixture() {
  const index = { read: jest.fn().mockResolvedValue([candidate]) };
  const reader = { read: jest.fn().mockResolvedValue({ revision: 3, live: true, title: 'A public topic' }) };
  const parents = { select: jest.fn().mockResolvedValue([{ target: candidate.target, slug: 'app', title: 'App' }]) };
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  return { index, reader, parents, policy, service: new ProfileCommunityActivity(index, reader, parents, policy, 'default') };
}
describe('community activity authority and visibility', () => {
  it('uses the contribution time and identity with the current public root destination', async () => {
    const f = fixture();
    expect((await f.service.read(request, actor)).items).toEqual([{ kind: 'reply', id: id(1), at: 100, title: 'A public topic', target: { kind: 'discussion', id: id(2), applicationSlug: 'app' } }]);
    expect(f.index.read).toHaveBeenCalledTimes(2);
  });
  it('omits invisible contributions and hidden parents with a progress cutoff', async () => {
    const f = fixture();
    f.index.read.mockResolvedValue(Array.from({ length: 11 }, (_, i) => ({ ...candidate, id: id(i + 1), at: 100 - i })));
    f.reader.read.mockRejectedValue(new DiscussionNotFoundError('Hidden parent'));
    expect(await f.service.read(request, actor)).toEqual({ items: [], through: { at: 91, key: `reply:${id(10)}` } });
  });
  it('requires exact generations and a final unchanged authority snapshot', async () => {
    const f = fixture(); f.reader.read.mockResolvedValueOnce({ revision: 2, live: true, title: 'stale' });
    await expect(f.service.read(request, actor)).rejects.toThrow();
    f.index.read.mockResolvedValueOnce([candidate]).mockResolvedValueOnce([]);
    await expect(f.service.read(request, actor)).rejects.toThrow();
  });
  it.each([ok(false), err(new Error('policy outage'))])('denies before index reads on policy %j', async (decision) => {
    const f = fixture(); f.policy.evaluate.mockResolvedValue(decision);
    await expect(f.service.read(request, actor)).rejects.toThrow();
    expect(f.index.read).not.toHaveBeenCalled();
  });
  it('rejects forged service identity, wrong tenant and excess input fields', async () => {
    const f = fixture();
    for (const untrusted of [{ ...actor, identityId: 'Other' }, { ...actor, tenantId: 'other' }, { ...actor, roles: [] }]) await expect(f.service.read(request, untrusted)).rejects.toThrow();
    await expect(f.service.read({ ...request, tenantId: 'other' }, actor)).rejects.toThrow();
    expect(f.index.read).not.toHaveBeenCalled();
  });
});
