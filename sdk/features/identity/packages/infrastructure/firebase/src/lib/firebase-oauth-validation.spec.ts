import fetch, { Response } from 'node-fetch';
import { FirebaseGoogleCodeExchanger } from './firebase-google-code-exchanger';
import { FirebaseGithubCodeExchanger } from './firebase-github-code-exchanger';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  Response: jest.requireActual('node-fetch').Response,
}));
const request = fetch as jest.MockedFunction<typeof fetch>;
const google = new FirebaseGoogleCodeExchanger({
  clientId: 'client',
  clientSecret: 'secret',
});
const github = new FirebaseGithubCodeExchanger({
  clientId: 'client',
  clientSecret: 'secret',
});
const response = (value: unknown) => new Response(JSON.stringify(value));

describe('OAuth provider response validation', () => {
  beforeEach(() => request.mockReset());
  it.each([google, github])(
    'returns an error Result on provider outage',
    async (adapter) => {
      request.mockRejectedValue(new Error('private provider failure'));
      expect(
        (
          await adapter.exchangeCode(
            'code',
            'https://app.test/callback',
            'verifier'
          )
        ).ok
      ).toBe(false);
    }
  );
  it.each([google, github])(
    'rejects missing tokens before requesting a profile',
    async (adapter) => {
      request.mockResolvedValue(response({}));
      expect(
        (
          await adapter.exchangeCode(
            'code',
            'https://app.test/callback',
            'verifier'
          )
        ).ok
      ).toBe(false);
      expect(request).toHaveBeenCalledTimes(1);
    }
  );
  it('binds a Google identity to the configured client audience', async () => {
    request
      .mockResolvedValueOnce(response({ id_token: 'token' }))
      .mockResolvedValueOnce(
        response({
          aud: 'other-client',
          email: 'alice@example.test',
          email_verified: true,
        })
      );
    expect(
      (
        await google.exchangeCode(
          'code',
          'https://app.test/callback',
          'verifier'
        )
      ).ok
    ).toBe(false);
  });
  it('accepts a valid Google profile', async () => {
    request
      .mockResolvedValueOnce(response({ id_token: 'token' }))
      .mockResolvedValueOnce(
        response({
          aud: 'client',
          email: 'alice@example.test',
          email_verified: 'true',
        })
      );
    expect(
      await google.exchangeCode('code', 'https://app.test/callback', 'verifier')
    ).toMatchObject({
      ok: true,
      value: { email: 'alice@example.test', emailVerified: true },
    });
  });
  it('never treats a public GitHub email as proof of verification', async () => {
    request
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(response({ email: 'alice@example.test' }))
      .mockResolvedValueOnce(
        response([
          { email: 'alice@example.test', primary: true, verified: false },
        ])
      );
    expect(
      (await github.exchangeCode('code', 'https://app.test/callback')).ok
    ).toBe(false);
  });
  it('chooses a verified GitHub email', async () => {
    request
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(response({ login: 'alice' }))
      .mockResolvedValueOnce(
        response([
          { email: 'unverified@example.test', primary: true, verified: false },
          { email: 'verified@example.test', primary: false, verified: true },
        ])
      );
    expect(
      await github.exchangeCode('code', 'https://app.test/callback')
    ).toMatchObject({
      ok: true,
      value: { email: 'verified@example.test', emailVerified: true },
    });
  });
});
