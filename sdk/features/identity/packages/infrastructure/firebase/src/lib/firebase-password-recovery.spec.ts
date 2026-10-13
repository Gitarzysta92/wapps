import fetch, { Response } from 'node-fetch';
import { FirebasePasswordRecovery } from './firebase-password-recovery';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  Response: jest.requireActual('node-fetch').Response,
}));
const request = fetch as jest.MockedFunction<typeof fetch>;

describe('Firebase password recovery delivery', () => {
  beforeEach(() => request.mockReset());
  it('requests bounded provider delivery without returning a secret reset link', async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ email: 'alice@example.test' }))
    );
    const adapter = new FirebasePasswordRecovery('local-key', 'localhost:9099');
    expect(await adapter.send('alice@example.test')).toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=local-key',
      expect.objectContaining({
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: 'alice@example.test',
        }),
        timeout: 10000,
        size: 16384,
      })
    );
  });
  it('does not expose account existence', async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'EMAIL_NOT_FOUND' } }), {
        status: 400,
      })
    );
    await expect(
      new FirebasePasswordRecovery('key', '').send('missing@example.test')
    ).resolves.toBeUndefined();
  });
  it.each([
    'TOO_MANY_ATTEMPTS_TRY_LATER',
    'OPERATION_NOT_ALLOWED',
    'INVALID_API_KEY',
  ])('propagates %s as service unavailable', async (code) => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: code } }), {
        status: 400,
      })
    );
    await expect(
      new FirebasePasswordRecovery('key', '').send('alice@example.test')
    ).rejects.toThrow('delivery unavailable');
  });
  it('does not turn network failure into accepted delivery', async () => {
    request.mockRejectedValue(new Error('secret provider diagnostic'));
    await expect(
      new FirebasePasswordRecovery('key', '').send('alice@example.test')
    ).rejects.toThrow('Password recovery delivery unavailable');
  });
  it('requires explicit provider configuration', () =>
    expect(() => new FirebasePasswordRecovery('')).toThrow(
      'FIREBASE_WEB_API_KEY'
    ));
});
