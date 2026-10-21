import { ok, err } from '@sdk/kernel/standard';
import { ProfilePublicationActivity } from './profile-activity';

const id = '00000000-0000-4000-8000-000000000001';
const candidate = { kind: 'article', id, at: 100, revision: 2, slug: 'public-article', applicationSlug: null, version: null };
const activity = { kind: 'article', id, at: 100, title: 'Reviewed title', target: { kind: 'article', id, slug: 'public-article' } };
const actor = { identityId: 'wapps-profile-reader', tenantId: 'default', roles: ['editorial:profile-reader'] };
const request = { ownerIdentityId: 'PrivateOwner', after: null, sharing: { suites: true, discussions: false, favorites: false } };
function fixture() {
  const index = { read: jest.fn().mockResolvedValue([candidate]) };
  const reader = { read: jest.fn().mockResolvedValue({ activity, revision: 2 }) };
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  return { index, reader, policy, service: new ProfilePublicationActivity(index, reader, policy, 'default') };
}
describe('publication activity current authorization and revision', () => {
  it('returns only reviewed current metadata and repeats its authoritative selection', async () => {
    const f = fixture();
    expect(await f.service.read(request, actor)).toEqual({ items: [activity], through: null });
    expect(f.index.read).toHaveBeenCalledTimes(2);
    expect(f.index.read).toHaveBeenCalledWith('PrivateOwner', null, true);
  });
  it.each([{ ...actor, identityId: 'owner' }, { ...actor, tenantId: 'other' }, { ...actor, roles: [] }])('rejects untrusted actor %j before index reads', async (untrusted) => {
    const f = fixture(); await expect(f.service.read(request, untrusted)).rejects.toThrow();
    expect(f.index.read).not.toHaveBeenCalled();
  });
  it.each([ok(false), err(new Error('outage'))])('fails closed on policy %j', async (value) => {
    const f = fixture(); f.policy.evaluate.mockResolvedValue(value);
    await expect(f.service.read(request, actor)).rejects.toThrow();
    expect(f.index.read).not.toHaveBeenCalled();
  });
  it('rejects missing generations and changes to publication/ownership during loading', async () => {
    const f = fixture(); f.reader.read.mockResolvedValueOnce({ activity, revision: 1 });
    await expect(f.service.read(request, actor)).rejects.toThrow();
    f.index.read.mockResolvedValueOnce([candidate]).mockResolvedValueOnce([]);
    await expect(f.service.read(request, actor)).rejects.toThrow();
  });
  it('rejects caller-selected tenant and malformed sharing', async () => {
    const f = fixture();
    await expect(f.service.read({ ...request, tenantId: 'other' }, actor)).rejects.toThrow();
    await expect(f.service.read({ ...request, sharing: {} }, actor)).rejects.toThrow();
    expect(f.index.read).not.toHaveBeenCalled();
  });
});
