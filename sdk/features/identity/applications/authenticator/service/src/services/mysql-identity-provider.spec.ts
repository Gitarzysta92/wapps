import { MysqlIdentityProvider } from './mysql-identity-provider';

const dto = { identityId: 'uid', claim: 'uid', provider: 'google', kind: 'user', identityType: 'email' };
describe('MySQL identity persistence', () => {
  const repo = { create: jest.fn(v => v), insert: jest.fn(), findOne: jest.fn() };
  const publisher = { publishCreated: jest.fn() };
  const provider = new MysqlIdentityProvider(repo as any, { get: () => publisher } as any);
  beforeEach(() => { jest.clearAllMocks(); repo.insert.mockReset(); repo.findOne.mockReset(); });
  it('distinguishes absence from a database error', async () => {
    repo.findOne.mockResolvedValue(null);
    expect(await provider.obtainIdentity('uid')).toEqual({ ok: true, value: null });
    repo.findOne.mockRejectedValue(new Error('connection lost'));
    expect((await provider.obtainIdentity('uid')).ok).toBe(false);
  });
  it('creates an active identity and publishes its creation once', async () => {
    const result = await provider.createIdentity(dto);
    expect(result.ok && result.value.canBeObtained()).toBe(true);
    expect(publisher.publishCreated).toHaveBeenCalledTimes(1);
  });
  it('preserves existing account state when two sign-ins race', async () => {
    repo.insert.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    repo.findOne.mockResolvedValue({ ...dto, id: 'existing', isActive: false, isSuspended: true, isDeleted: false, createdAt: 1 });
    const result = await provider.createIdentity(dto);
    expect(result.ok && result.value.isSuspended).toBe(true);
    expect(publisher.publishCreated).not.toHaveBeenCalled();
  });
});
