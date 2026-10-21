import {
  CanonicalIdentityStore,
  CredentialIdentityBindings,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import { err, ok } from '@sdk/kernel/standard';
import {
  CredentialRegistrationRejected,
  CredentialRegistrationService,
} from './credential-registration';
import { IdentityAuthenticationUnavailable } from './identity-authentication.service';

describe('credential registration', () => {
  const state = {
    identityId: 'Uid',
    subjectId: 'subject',
    provider: 'email',
    kind: 'user',
    revision: 1,
    isActive: true,
    isSuspended: false,
    isDeleted: false,
    createdAt: 100,
    updatedAt: 100,
    deletedAt: 0,
  };
  const session = {
    uid: 'credential-subject',
    enrollmentEligible: true,
    token: 'token',
    refreshToken: 'refresh',
    expiresIn: '3600',
  };
  const input = {
    email: 'alice@example.test',
    nickname: 'Alice',
    password: 'password',
    passwordConfirmation: 'password',
  };
  function fixture() {
    const credentials = {
      registerOrAuthenticate: jest.fn().mockResolvedValue(ok(session)),
    };
    const identities: jest.Mocked<
      CanonicalIdentityStore & CredentialIdentityBindings
    > = {
      find: jest.fn(),
      findCredential: jest.fn(),
      credentialSubjects: jest.fn(),
      enrollCredential: jest.fn().mockResolvedValue(state),
      setSuspended: jest.fn(),
      findDeletion: jest.fn(),
    requestDeletion: jest.fn(),
      ensure: jest.fn().mockResolvedValue({ state, created: false }),
      recordAuthentication: jest.fn().mockResolvedValue(undefined),
    };
    const enrollment = {
      enrollAccount: jest.fn().mockResolvedValue({
        identityId: 'Uid',
        revision: 2,
        registered: true,
      }),
    };
    return {
      credentials,
      identities,
      enrollment,
      service: new CredentialRegistrationService(
        credentials,
        identities,
        enrollment,
        'issuer-A'
      ),
    };
  }
  it('resolves a verified credential subject to an independent stable Wapps ID and returns a session after durable authentication', async () => {
    const f = fixture();
    expect(await f.service.register(input, 'key')).toEqual(
      ok({
        token: session.token,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        uid: 'Uid',
      })
    );
    expect(f.identities.enrollCredential).toHaveBeenCalledWith(
      { issuer: 'issuer-A', subject: 'credential-subject' },
      true
    );
    expect(f.enrollment.enrollAccount).toHaveBeenCalledWith(
      'Uid',
      'Alice',
      'key'
    );
    expect(f.identities.recordAuthentication).toHaveBeenCalledWith(
      'Uid',
      'credentials'
    );
    expect(
      f.identities.recordAuthentication.mock.invocationCallOrder[0]
    ).toBeGreaterThan(f.enrollment.enrollAccount.mock.invocationCallOrder[0]);
  });
  it.each([
    { email: 'bad' },
    { nickname: ' ' },
    { passwordConfirmation: 'different' },
    { password: 'tiny' },
  ])(
    'validates input before creating provider credentials: %j',
    async (patch) => {
      const f = fixture();
      expect(
        await f.service.register({ ...input, ...patch }, 'key')
      ).toMatchObject({
        ok: false,
        error: expect.any(CanonicalIdentityInputError),
      });
      expect(f.credentials.registerOrAuthenticate).not.toHaveBeenCalled();
    }
  );
  it('requires idempotency before creating credentials', async () => {
    const f = fixture();
    expect((await f.service.register(input, '')).ok).toBe(false);
    expect(f.credentials.registerOrAuthenticate).not.toHaveBeenCalled();
  });
  it('does not provision authority after rejected credentials', async () => {
    const f = fixture();
    f.credentials.registerOrAuthenticate.mockResolvedValue(
      err(new CredentialRegistrationRejected('Rejected'))
    );
    expect((await f.service.register(input, 'key')).ok).toBe(false);
    expect(f.identities.enrollCredential).not.toHaveBeenCalled();
  });
  it.each([{ isSuspended: true }, { isDeleted: true }, { isActive: false }])(
    'preserves lifecycle restrictions: %j',
    async (patch) => {
      const f = fixture();
      f.identities.enrollCredential.mockResolvedValue({ ...state, ...patch });
      expect(await f.service.register(input, 'key')).toMatchObject({
        ok: false,
        error: expect.any(CanonicalIdentityAccessDenied),
      });
      expect(f.enrollment.enrollAccount).not.toHaveBeenCalled();
    }
  );
  it('reports an already enrolled account as conflict', async () => {
    const f = fixture();
    f.enrollment.enrollAccount.mockRejectedValue(
      new CanonicalIdentityConflict('Already enrolled')
    );
    expect(await f.service.register(input, 'key')).toMatchObject({
      ok: false,
      error: expect.any(CanonicalIdentityConflict),
    });
    expect(f.identities.recordAuthentication).not.toHaveBeenCalled();
  });
  it('supports retry after the provider succeeds but SQL enrollment fails', async () => {
    const f = fixture();
    f.enrollment.enrollAccount.mockRejectedValueOnce(
      new Error('private SQL diagnostic')
    );
    expect(await f.service.register(input, 'key')).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
    expect(f.identities.recordAuthentication).not.toHaveBeenCalled();
    expect(await f.service.register(input, 'key')).toEqual(
      ok({
        token: session.token,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        uid: 'Uid',
      })
    );
    expect(f.credentials.registerOrAuthenticate).toHaveBeenCalledTimes(2);
  });
  it('withholds tokens if access changes or durable authentication fails after enrollment', async () => {
    const f = fixture();
    f.identities.recordAuthentication.mockRejectedValue(
      new CanonicalIdentityConflict('Unavailable')
    );
    expect(await f.service.register(input, 'key')).toMatchObject({
      ok: false,
      error: expect.any(CanonicalIdentityConflict),
    });
    f.identities.recordAuthentication.mockRejectedValue(new Error('outbox'));
    expect(await f.service.register(input, 'key')).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
  });
});
