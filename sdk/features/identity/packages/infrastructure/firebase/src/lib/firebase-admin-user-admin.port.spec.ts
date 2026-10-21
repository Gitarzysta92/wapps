import type * as admin from 'firebase-admin';
import {
  CredentialInputError,
  CredentialUnavailable,
} from '@sdk/features/identity/libs/management';
import { FirebaseAdminUserAdminPort } from './firebase-admin-user-admin.port';

describe('Firebase credential administration', () => {
  const provider = {
    deleteUser: jest.fn(),
    updateUser: jest.fn(),
    revokeRefreshTokens: jest.fn(),
    getUser: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    generateEmailVerificationLink: jest.fn(),
  };
  const adapter = new FirebaseAdminUserAdminPort(
    () => provider as unknown as admin.auth.Auth,
    100
  );
  beforeEach(() => jest.resetAllMocks());
  it('treats already absent credentials as successful idempotent cleanup', async () => {
    provider.deleteUser.mockRejectedValue({ code: 'auth/user-not-found' });
    expect(await adapter.deleteUser('Uid')).toEqual({ ok: true, value: true });
  });
  it('retains a provider failure for retry', async () => {
    provider.deleteUser.mockRejectedValue({
      code: 'auth/internal-error',
      message: 'secret',
    });
    expect(await adapter.deleteUser('Uid')).toEqual({
      ok: false,
      error: new CredentialUnavailable('Credential provider unavailable'),
    });
  });
  it.each([
    'generatePasswordResetLink',
    'generateEmailVerificationLink',
  ] as const)('binds %s to the authorized target email', async (method) => {
    provider.getUser.mockResolvedValue({ email: 'target@example.test' });
    const result = await adapter[method]('Uid', 'different@example.test');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(CredentialInputError);
    expect(provider[method]).not.toHaveBeenCalled();
    expect(provider.getUser).toHaveBeenCalledWith('Uid');
  });
  it('generates a link only after resolving the target', async () => {
    provider.getUser.mockResolvedValue({ email: 'TARGET@example.test' });
    provider.generatePasswordResetLink.mockResolvedValue(
      'provider-secret-link'
    );
    expect(
      await adapter.generatePasswordResetLink('Uid', 'target@example.test')
    ).toEqual({ ok: true, value: 'provider-secret-link' });
  });
  it('bounds a stalled provider operation', async () => {
    jest.useFakeTimers();
    try {
      provider.deleteUser.mockReturnValue(new Promise(() => undefined));
      const result = adapter.deleteUser('Uid');
      await jest.advanceTimersByTimeAsync(100);
      expect(await result).toEqual({
        ok: false,
        error: new CredentialUnavailable('Credential provider unavailable'),
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
