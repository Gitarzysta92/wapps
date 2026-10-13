import { Test } from '@nestjs/testing';
import { err, ok } from '@sdk/kernel/standard';
import { TokenValidationError } from '@sdk/extras/identity-firebase';
import {
  EmailVerificationAuthenticationRequired,
  IdentityAuthenticationUnavailable,
} from '@sdk/features/identity/libs/authentication';
import { TokenValidationService } from '../services/token-validation.service';
import { CredentialEmailAuthorityAdapter } from './credential-email-authority.adapter';

describe('credential self authorization adapter', () => {
  it.each([
    [new Error('Suspended identity'), EmailVerificationAuthenticationRequired],
    [
      new TokenValidationError('Revoked', 'auth/id-token-revoked'),
      EmailVerificationAuthenticationRequired,
    ],
    [
      new TokenValidationError(
        'Private network failure',
        'auth/internal-error'
      ),
      IdentityAuthenticationUnavailable,
    ],
    [
      new IdentityAuthenticationUnavailable('Private SQL'),
      IdentityAuthenticationUnavailable,
    ],
  ])('retains rejection versus outage: %s', async (error, expected) => {
    const module = await Test.createTestingModule({
      providers: [
        CredentialEmailAuthorityAdapter,
        {
          provide: TokenValidationService,
          useValue: { validateRequired: async () => err(error) },
        },
      ],
    }).compile();
    const result = await module
      .get(CredentialEmailAuthorityAdapter)
      .authorize('token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(expected);
    await module.close();
  });
  it('uses the revocation and canonical-lifecycle validator for every request', async () => {
    const validateRequired = jest
      .fn()
      .mockResolvedValue(ok({ uid: 'current', email: 'stale@example.test' }));
    const module = await Test.createTestingModule({
      providers: [
        CredentialEmailAuthorityAdapter,
        { provide: TokenValidationService, useValue: { validateRequired } },
      ],
    }).compile();
    expect(
      await module.get(CredentialEmailAuthorityAdapter).authorize('token')
    ).toEqual(ok({ uid: 'current' }));
    expect(validateRequired).toHaveBeenCalledWith('Bearer token');
    await module.close();
  });
});
