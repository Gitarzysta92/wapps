import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import {
  CanonicalIdentityStore,
  CanonicalIdentityState,
} from '@sdk/features/identity/core';
import { err, ok } from '@sdk/kernel/standard';
import { IdentityManagementService } from './identity-management.service';
import { IUserAdminPort } from './ports/user-admin.port';

const state: CanonicalIdentityState = {
  identityId: 'target',
  subjectId: 'subject',
  kind: 'user',
  provider: 'email',
  isActive: true,
  isSuspended: false,
  isDeleted: false,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
};
const ctx = {
  identityId: 'operator',
  timestamp: 1,
  subject: { roles: ['admin'] },
};

function fixture() {
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  const identities: jest.Mocked<CanonicalIdentityStore> = {
    find: jest.fn().mockResolvedValue(state),
    ensure: jest.fn(),
    recordAuthentication: jest.fn(),
    setSuspended: jest.fn().mockResolvedValue(state),
    requestDeletion: jest
      .fn()
      .mockResolvedValue({
        ...state,
        isActive: false,
        isDeleted: true,
        revision: 2,
        cleanup: 'pending',
      }),
  };
  const credentials: jest.Mocked<IUserAdminPort> = {
    updateUser: jest.fn().mockResolvedValue(ok(true)),
    deleteUser: jest.fn(),
    revokeRefreshTokens: jest.fn().mockResolvedValue(ok(true)),
    generatePasswordResetLink: jest.fn().mockResolvedValue(ok('link')),
    generateEmailVerificationLink: jest.fn().mockResolvedValue(ok('link')),
  };
  return {
    evaluate,
    identities,
    credentials,
    service: new IdentityManagementService(authority, credentials, identities),
  };
}

describe('identity administration application boundary', () => {
  const operations = [
    (service: IdentityManagementService) => service.disableUser('target', ctx),
    (service: IdentityManagementService) => service.enableUser('target', ctx),
    (service: IdentityManagementService) => service.deleteUser('target', ctx),
    (service: IdentityManagementService) => service.revokeTokens('target', ctx),
    (service: IdentityManagementService) =>
      service.updateEmail('target', 'alice@example.test', ctx),
    (service: IdentityManagementService) =>
      service.updatePassword('target', 'a-valid-password', ctx),
    (service: IdentityManagementService) =>
      service.unlinkProviders('target', ['google.com'], ctx),
    (service: IdentityManagementService) =>
      service.generatePasswordResetLink('target', 'alice@example.test', ctx),
    (service: IdentityManagementService) =>
      service.generateEmailVerificationLink(
        'target',
        'alice@example.test',
        ctx
      ),
  ];
  it.each(operations)(
    'never performs an operation after policy false',
    async (operation) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(ok(false));
      expect((await operation(f.service)).ok).toBe(false);
      for (const method of [
        ...Object.values(f.identities),
        ...Object.values(f.credentials),
      ])
        expect(method).not.toHaveBeenCalled();
    }
  );
  it('suspends application identity through current SQL authority', async () => {
    const f = fixture();
    expect(await f.service.disableUser('target', ctx)).toEqual(ok(true));
    expect(f.identities.setSuspended).toHaveBeenCalledWith('target', true);
    expect(f.credentials.updateUser).not.toHaveBeenCalled();
  });
  it('returns tombstone acceptance while provider cleanup remains durable work', async () => {
    const f = fixture();
    expect(await f.service.deleteUser('target', ctx)).toEqual(
      ok({
        identityId: 'target',
        revision: 2,
        status: 'accepted',
        cleanup: 'pending',
      })
    );
    expect(f.credentials.deleteUser).not.toHaveBeenCalled();
  });
  it('does not hide a failed canonical commit', async () => {
    const f = fixture();
    f.identities.setSuspended.mockRejectedValue(new Error('SQL'));
    expect(await f.service.disableUser('target', ctx)).toEqual(
      err(new Error('SQL'))
    );
  });
  it('does not create a target as a side effect of credential administration', async () => {
    const f = fixture();
    f.identities.find.mockResolvedValue(null);
    expect((await f.service.updatePassword('target', 'password', ctx)).ok).toBe(
      false
    );
    expect(f.identities.ensure).not.toHaveBeenCalled();
    expect(f.credentials.updateUser).not.toHaveBeenCalled();
  });
  it('carries the authorized UID to the provider email-binding check', async () => {
    const f = fixture();
    await f.service.generatePasswordResetLink(
      'target',
      'alice@example.test',
      ctx
    );
    expect(f.credentials.generatePasswordResetLink).toHaveBeenCalledWith(
      'target',
      'alice@example.test'
    );
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'operator',
        resource: { type: 'user', id: 'target' },
      })
    );
  });
});
