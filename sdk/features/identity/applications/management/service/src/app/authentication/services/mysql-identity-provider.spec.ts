import { ConfigService } from '@nestjs/config';
import {
  CanonicalIdentityState,
  CanonicalIdentityStore,
  CredentialIdentityBindings,
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
  const store: CanonicalIdentityStore & CredentialIdentityBindings = {
    find,
    findCredential: find,
    enrollCredential: jest.fn(),
    credentialSubjects: jest.fn(),
    ensure,
    recordAuthentication: jest.fn(),
    setSuspended: jest.fn(),
    findDeletion: jest.fn(),
    requestDeletion: jest.fn(),
  };
  const provider = new MysqlIdentityProvider(
    store,
    new ConfigService({ AUTH_ISSUER: 'issuer-A' })
  );
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
  it('resolves exact issuer and subject to the existing Wapps identity', async () => {
    find.mockResolvedValue({ ...state, identityId: 'stable-wapps-id' });
    const result = await provider.obtainIdentity('external-subject');
    expect(result.ok && result.value?.identityId).toBe('stable-wapps-id');
    expect(find).toHaveBeenCalledWith({
      issuer: 'issuer-A',
      subject: 'external-subject',
    });
  });
  it('preserves the mapped identity lifecycle', async () => {
    find.mockResolvedValue({ ...state, isSuspended: true });
    const result = await provider.obtainIdentity('external-subject');
    expect(result.ok && result.value?.canBeObtained()).toBe(false);
  });
  it('does not let credentials inject a different actor ID', async () => {
    expect(
      (await provider.createIdentity({ ...dto, identityId: 'other' })).ok
    ).toBe(false);
    expect(ensure).not.toHaveBeenCalled();
  });
});
