import type * as admin from 'firebase-admin';
import { FirebaseAdminIdTokenVerifier } from './firebase-admin-id-token-verifier';

describe('verified Firebase authorization claims', () => {
  const verifyIdToken = jest.fn();
  const verifier = new FirebaseAdminIdTokenVerifier(
    () => ({ verifyIdToken } as unknown as admin.auth.Auth)
  );
  beforeEach(() => verifyIdToken.mockReset());
  it('passes only supported verified top-level claims and checks revocation', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'Uid',
      email: 'alice@example.test',
      auth_time: 123,
      roles: ['admin'],
      tenantId: 'tenant',
      other: 'private-claim',
    });
    expect(await verifier.verifyIdToken('token')).toEqual({
      ok: true,
      value: {
        uid: 'Uid',
        email: 'alice@example.test',
        authTime: 123,
        claims: { roles: ['admin'], tenantId: 'tenant' },
      },
    });
    expect(verifyIdToken).toHaveBeenCalledWith('token', true);
  });
  it.each([
    { roles: 'admin' },
    { roles: [1] },
    { tenantId: '' },
    { tenantId: ' tenant' },
  ])('rejects malformed authorization claims: %j', async (claims) => {
    verifyIdToken.mockResolvedValue({ uid: 'Uid', ...claims });
    expect((await verifier.verifyIdToken('token')).ok).toBe(false);
  });
  it('does not grant privileges from an unsupported nested custom_claims field', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'Uid',
      custom_claims: { roles: ['admin'] },
    });
    const result = await verifier.verifyIdToken('token');
    expect(result.ok && result.value.claims).toEqual({});
  });
});
