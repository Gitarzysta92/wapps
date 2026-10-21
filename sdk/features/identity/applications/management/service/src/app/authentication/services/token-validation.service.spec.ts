import { TokenValidationService } from './token-validation.service';
import { err, ok } from '@sdk/kernel/standard';
import type { CredentialTokenVerifier } from '@sdk/features/identity/libs/authentication';
import type { MysqlIdentityProvider } from './mysql-identity-provider';

describe('Token validation', () => {
  const verifier = { verifyIdToken: jest.fn() };
  const identities = { obtainIdentity: jest.fn() };
  const service = new TokenValidationService(
    verifier as unknown as CredentialTokenVerifier,
    identities as unknown as MysqlIdentityProvider
  );
  beforeEach(() => jest.resetAllMocks());
  it.each([
    'Bearer signed-token',
    'bearer signed-token',
    'BEARER\tsigned-token',
  ])('validates the token in %j', async (header) => {
    verifier.verifyIdToken.mockResolvedValue(ok({ uid: 'uid' }));
    identities.obtainIdentity.mockResolvedValue(
      ok({ identityId: 'stable-wapps-id', canBeObtained: () => true })
    );
    expect((await service.validateRequired(header)).ok).toBe(true);
    expect(verifier.verifyIdToken).toHaveBeenCalledWith('signed-token');
  });
  it.each([
    undefined,
    '',
    'Basic signed-token',
    'signed-token',
    'Bearer ',
    'Bearer\\ssigned-token',
  ])(
    'rejects malformed header %j without validating a token',
    async (header) => {
      expect((await service.validateRequired(header)).ok).toBe(false);
      expect(verifier.verifyIdToken).not.toHaveBeenCalled();
    }
  );
  it('rejects a malformed bearer header without contacting the credential provider', async () => {
    expect((await service.validateRequired('Bearer one two')).ok).toBe(false);
    expect(verifier.verifyIdToken).not.toHaveBeenCalled();
  });
  it('rejects revoked/expired tokens before looking up an identity', async () => {
    verifier.verifyIdToken.mockResolvedValue(err(new Error('revoked')));
    expect((await service.validateRequired('Bearer token')).ok).toBe(false);
    expect(identities.obtainIdentity).not.toHaveBeenCalled();
  });
  it('requires an available application identity even for a valid token', async () => {
    verifier.verifyIdToken.mockResolvedValue(ok({ uid: 'uid' }));
    identities.obtainIdentity.mockResolvedValue(ok(null));
    expect((await service.validateRequired('Bearer token')).ok).toBe(false);
  });
  it('returns the verified principal for an active identity', async () => {
    verifier.verifyIdToken.mockResolvedValue(
      ok({ uid: 'uid', email: 'a@example.com' })
    );
    identities.obtainIdentity.mockResolvedValue(
      ok({ identityId: 'stable-wapps-id', canBeObtained: () => true })
    );
    expect(await service.validateRequired('Bearer token')).toEqual(
      ok({ uid: 'stable-wapps-id', email: 'a@example.com' })
    );
  });
  it('allows a missing token for optional authentication', async () => {
    expect(await service.validateOptional()).toEqual(
      ok({ authenticated: false })
    );
    expect(verifier.verifyIdToken).not.toHaveBeenCalled();
  });
});
