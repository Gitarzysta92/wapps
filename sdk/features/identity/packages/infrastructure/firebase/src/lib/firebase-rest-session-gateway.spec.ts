import fetch from 'node-fetch';
import { FirebaseRestSessionGateway } from './firebase-rest-session-gateway';

jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }));
const request = fetch as jest.MockedFunction<typeof fetch>;

describe('Firebase REST endpoint selection', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({
      ok: true,
      json: async () => ({
        idToken: 'token', refreshToken: 'refresh', expiresIn: '3600', localId: 'user',
        id_token: 'token', refresh_token: 'refresh', expires_in: '3600', user_id: 'user',
      }),
    } as any);
  });

  it.each([
    ['password', 'identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'],
    ['anonymous', 'identitytoolkit.googleapis.com/v1/accounts:signUp'],
    ['custom', 'identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken'],
    ['refresh', 'securetoken.googleapis.com/v1/token'],
  ])('routes %s sessions to the emulator', async (kind, endpoint) => {
    const gateway = new FirebaseRestSessionGateway('local-key', 'firebase-auth:9099');
    const result = kind === 'password' ? await gateway.signInWithPassword('local@example.test', 'password')
      : kind === 'anonymous' ? await gateway.signUpAnonymous()
      : kind === 'custom' ? await gateway.signInWithCustomToken('custom-token')
      : await gateway.refresh('refresh-token');
    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledWith(`http://firebase-auth:9099/${endpoint}?key=local-key`, expect.any(Object));
  });

  it('keeps Google endpoints when emulator mode is disabled', async () => {
    await new FirebaseRestSessionGateway('cloud-key', '').signUpAnonymous();
    expect(request).toHaveBeenCalledWith(
      'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=cloud-key', expect.any(Object)
    );
  });
});
