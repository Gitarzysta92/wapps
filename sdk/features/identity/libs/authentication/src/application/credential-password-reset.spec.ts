import { CanonicalIdentityInputError } from '@sdk/features/identity/core';
import {
  CredentialPasswordResetService,
  PasswordResetRejected,
} from './credential-password-reset';
import { IdentityAuthenticationUnavailable } from './identity-authentication.service';

describe('credential reset', () => {
  const provider = { verify: jest.fn(), complete: jest.fn() };
  const service = new CredentialPasswordResetService(provider);
  beforeEach(() => jest.resetAllMocks());
  it('verifies a code without changing credentials', async () => {
    expect(await service.verify('code-1')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(provider.verify).toHaveBeenCalledWith('code-1');
    expect(provider.complete).not.toHaveBeenCalled();
  });
  it('consumes the code with the new password', async () => {
    expect(
      (
        await service.complete({
          code: 'code',
          password: 'password',
          passwordConfirmation: 'password',
        })
      ).ok
    ).toBe(true);
    expect(provider.complete).toHaveBeenCalledWith('code', 'password');
  });
  it.each(['', 'code?secret=1', 'x'.repeat(2049)])(
    'rejects malformed code before provider access',
    async (code) => {
      expect(await service.verify(code)).toMatchObject({
        ok: false,
        error: expect.any(CanonicalIdentityInputError),
      });
      expect(provider.verify).not.toHaveBeenCalled();
    }
  );
  it('does not consume a code when passwords differ', async () => {
    expect(
      (
        await service.complete({
          code: 'code',
          password: 'password',
          passwordConfirmation: 'different',
        })
      ).ok
    ).toBe(false);
    expect(provider.complete).not.toHaveBeenCalled();
  });
  it('distinguishes a rejected action code from provider outage', async () => {
    provider.verify.mockRejectedValue(new PasswordResetRejected('Expired'));
    expect(await service.verify('code')).toMatchObject({
      ok: false,
      error: expect.any(PasswordResetRejected),
    });
    provider.verify.mockRejectedValue(new Error('secret'));
    expect(await service.verify('code')).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
  });
});
