import { ok } from '@sdk/kernel/standard';
import { ProfilePublicationTotals } from './profile-totals';
const actor = {
  identityId: 'wapps-profile-reader',
  tenantId: 'default',
  roles: ['editorial:profile-reader'],
};
const input = { ownerIdentityId: 'owner', categories: ['suites', 'articles'] };
describe('publication profile totals', () => {
  const source = { read: jest.fn() },
    policy = { evaluate: jest.fn() };
  const service = new ProfilePublicationTotals(source, policy, 'default');
  beforeEach(() => {
    jest.clearAllMocks();
    policy.evaluate.mockResolvedValue(ok(true));
    source.read.mockResolvedValue({ suites: 37, articles: 52 });
  });
  it('preserves full canonical counts', async () =>
    expect(await service.read(input, actor)).toEqual({
      suites: 37,
      articles: 52,
    }));
  it('denies wrong identities, roles and tenants before reads', async () => {
    for (const override of [
      { identityId: 'owner' },
      { roles: ['admin'] },
      { tenantId: 'other' },
    ])
      await expect(
        service.read(input, { ...actor, ...override })
      ).rejects.toThrow();
    expect(source.read).not.toHaveBeenCalled();
  });
  it('rejects injected scope and unrelated categories', async () => {
    await expect(
      service.read({ ...input, tenantId: 'other' }, actor)
    ).rejects.toThrow();
    await expect(
      service.read({ ...input, categories: ['discussions'] }, actor)
    ).rejects.toThrow();
    expect(source.read).not.toHaveBeenCalled();
  });
  it('requires an affirmative policy result', async () => {
    policy.evaluate.mockResolvedValue(ok(false));
    await expect(service.read(input, actor)).rejects.toThrow();
    expect(source.read).not.toHaveBeenCalled();
  });
  it('rejects an incomplete or malformed source response', async () => {
    source.read.mockResolvedValue({ suites: 1 });
    await expect(service.read(input, actor)).rejects.toThrow();
    source.read.mockResolvedValue({ suites: 1, articles: -1 });
    await expect(service.read(input, actor)).rejects.toThrow();
  });
});
