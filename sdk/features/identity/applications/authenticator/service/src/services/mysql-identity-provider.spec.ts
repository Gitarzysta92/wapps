import {
  CanonicalIdentityState,
  CanonicalIdentityStore,
} from '@sdk/features/identity/core';
import { MysqlIdentityProvider } from './mysql-identity-provider';

const dto = {
  identityId: 'uid',
  claim: 'uid',
  provider: 'google',
  kind: 'user',
  identityType: 'email',
};
const state: CanonicalIdentityState = {
  identityId: 'uid',
  subjectId: 'subject',
  provider: 'google',
  kind: 'user',
  isActive: true,
  isSuspended: false,
  isDeleted: false,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  revision: 1,
};
describe('canonical identity authentication adapter', () => {
  const find = jest.fn();
  const ensure = jest.fn();
  const store: CanonicalIdentityStore = {
    find,
    ensure,
    recordAuthentication: jest.fn(),
    setSuspended: jest.fn(),
    requestDeletion: jest.fn(),
  };
  const provider = new MysqlIdentityProvider(store);
  beforeEach(() => {
    find.mockReset();
    ensure.mockReset();
  });
  it('distinguishes absence from a database error', async () => {
    find.mockResolvedValue(null);
    expect(await provider.obtainIdentity('uid')).toEqual({
      ok: true,
      value: null,
    });
    find.mockRejectedValue(new Error('connection lost'));
    expect((await provider.obtainIdentity('uid')).ok).toBe(false);
  });
  it('uses the same canonical UID and existing subject for authenticated identity', async () => {
    ensure.mockResolvedValue({ state, created: true });
    const result = await provider.createIdentity(dto);
    expect(result.ok && result.value.canBeObtained()).toBe(true);
    expect(result.ok && result.value.identityId).toBe('uid');
    expect(ensure).toHaveBeenCalledWith({
      uid: 'uid',
      provider: 'google',
      kind: 'user',
      activate: true,
    });
  });
  it('preserves a concurrent provisioning winner and its restrictions', async () => {
    ensure.mockResolvedValue({
      state: { ...state, isSuspended: true },
      created: false,
    });
    const result = await provider.createIdentity(dto);
    expect(result.ok && result.value.isSuspended).toBe(true);
    expect(result.ok && result.value.canBeObtained()).toBe(false);
  });
  it('does not let credentials inject a different actor ID', async () => {
    expect(
      (await provider.createIdentity({ ...dto, identityId: 'other' })).ok
    ).toBe(false);
    expect(ensure).not.toHaveBeenCalled();
  });
});
