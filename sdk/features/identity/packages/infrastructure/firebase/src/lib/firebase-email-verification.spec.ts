import fetch, { Response } from 'node-fetch';
import { FirebaseEmailVerification } from './firebase-email-verification';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  Response: jest.requireActual('node-fetch').Response,
}));
const request = fetch as jest.MockedFunction<typeof fetch>;
const session = { uid: 'member', token: 'secret-token' };
const address = 'member@example.test';
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const status = (user: object) =>
  response({
    users: [
      { localId: session.uid, email: address, emailVerified: false, ...user },
    ],
  });
const adapter = new FirebaseEmailVerification('key', '127.0.0.1:9099');

describe('bounded Firebase email verification', () => {
  beforeEach(() => request.mockReset());
  it('reads current provider status rather than stale token claims', async () => {
    request.mockResolvedValueOnce(status({ emailVerified: true }));
    expect(await adapter.status(session)).toEqual({
      email: address,
      verified: true,
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('accounts:lookup?'),
      expect.objectContaining({
        body: JSON.stringify({ idToken: session.token }),
        timeout: 10000,
        size: 16384,
      })
    );
  });
  it.each([
    { localId: 'someone-else' },
    { disabled: true },
    { emailVerified: 'false' },
    { email: 'bad' },
  ])('rejects invalid or foreign provider state: %j', async (patch) => {
    request.mockResolvedValueOnce(status(patch));
    await expect(adapter.status(session)).rejects.toThrow();
  });
  it('handles omitted false defaults and accounts without an email truthfully', async () => {
    request.mockImplementation(async () =>
      response({ users: [{ localId: session.uid }] })
    );
    expect(await adapter.status(session)).toEqual({
      email: null,
      verified: false,
    });
    await expect(adapter.request(session)).rejects.toThrow('no email address');
    expect(
      request.mock.calls.every(([url]) =>
        String(url).includes('accounts:lookup')
      )
    ).toBe(true);
  });
  it('sends only to the authenticated credential and reports accepted request', async () => {
    request
      .mockResolvedValueOnce(status({}))
      .mockResolvedValueOnce(response({ email: address }));
    expect(await adapter.request(session)).toBe('requested');
    expect(request).toHaveBeenLastCalledWith(
      expect.stringContaining('accounts:sendOobCode?'),
      expect.objectContaining({
        body: JSON.stringify({
          requestType: 'VERIFY_EMAIL',
          idToken: session.token,
        }),
      })
    );
  });
  it('does not resend for a currently verified email', async () => {
    request.mockResolvedValueOnce(status({ emailVerified: true }));
    expect(await adapter.request(session)).toBe('already-verified');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([
    'PASSWORD_RESET',
    'RECOVER_EMAIL',
    'VERIFY_AND_CHANGE_EMAIL',
    undefined,
  ])('rejects action type %s before any mutation', async (requestType) => {
    request.mockImplementation(async () =>
      response({ email: address, requestType })
    );
    await expect(adapter.verify('code')).rejects.toThrow(
      'not an email verification'
    );
    await expect(adapter.complete('code')).rejects.toThrow(
      'not an email verification'
    );
    expect(
      request.mock.calls.every(([url]) =>
        String(url).includes('accounts:resetPassword')
      )
    ).toBe(true);
  });
  it('inspects then consumes without returning a session or requiring optional provider fields', async () => {
    request
      .mockResolvedValueOnce(
        response({ email: address, requestType: 'VERIFY_EMAIL' })
      )
      .mockResolvedValueOnce(response({ email: address }));
    expect(await adapter.complete('code')).toBeUndefined();
    expect(request).toHaveBeenLastCalledWith(
      expect.stringContaining('accounts:update?'),
      expect.objectContaining({ body: JSON.stringify({ oobCode: 'code' }) })
    );
  });
  it.each([
    { email: 'other@example.test' },
    { email: address, emailVerified: false },
    {},
  ])('does not confirm malformed completion: %j', async (body) => {
    request
      .mockResolvedValueOnce(
        response({ email: address, requestType: 'VERIFY_EMAIL' })
      )
      .mockResolvedValueOnce(response(body));
    await expect(adapter.complete('code')).rejects.toThrow();
  });
  it.each([
    ['INVALID_OOB_CODE', 'invalid or no longer available'],
    ['EXPIRED_OOB_CODE', 'invalid or no longer available'],
    ['TOO_MANY_ATTEMPTS_TRY_LATER', 'Too many attempts'],
    ['USER_DISABLED', 'Sign in again'],
    ['INVALID_API_KEY', 'unavailable'],
  ])('maps %s without raw provider diagnostics', async (code, message) => {
    request.mockResolvedValue(response({ error: { message: code } }, 400));
    await expect(adapter.verify('code')).rejects.toThrow(message);
  });
  it('does not retry a lost request response', async () => {
    request
      .mockResolvedValueOnce(status({}))
      .mockRejectedValueOnce(new Error('secret diagnostic'));
    await expect(adapter.request(session)).rejects.toThrow('unavailable');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
