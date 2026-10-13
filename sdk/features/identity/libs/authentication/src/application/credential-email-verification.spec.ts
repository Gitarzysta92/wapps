import { err, ok } from '@sdk/kernel/standard';
import { IdentityAuthenticationUnavailable } from './identity-authentication.service';
import {
  CredentialEmailVerificationService,
  EmailVerificationAuthenticationRequired,
  EmailVerificationRejected,
  EmailVerificationThrottled,
} from './credential-email-verification';

describe('credential email verification boundary', () => {
  const authority = { authorize: jest.fn() };
  const provider = {
    status: jest.fn(),
    request: jest.fn(),
    verify: jest.fn(),
    complete: jest.fn(),
  };
  const service = new CredentialEmailVerificationService(authority, provider);
  beforeEach(() => {
    jest.resetAllMocks();
    authority.authorize.mockResolvedValue(ok({ uid: 'current-uid' }));
    provider.status.mockResolvedValue({
      email: 'a@example.test',
      verified: false,
    });
    provider.request.mockResolvedValue('requested');
  });
  it('authorizes self reads and delivery with the current canonical principal', async () => {
    expect((await service.status('token')).ok).toBe(true);
    expect(await service.request('token')).toEqual(ok('requested'));
    expect(authority.authorize).toHaveBeenCalledTimes(2);
    expect(provider.status).toHaveBeenCalledWith({
      uid: 'current-uid',
      token: 'token',
    });
    expect(provider.request).toHaveBeenCalledWith({
      uid: 'current-uid',
      token: 'token',
    });
  });
  it.each(['', 'token with space', 't'.repeat(16385)])(
    'rejects malformed sessions before provider I/O',
    async (token) => {
      expect((await service.status(token)).ok).toBe(false);
      expect((await service.request(token)).ok).toBe(false);
      expect(authority.authorize).not.toHaveBeenCalled();
      expect(provider.request).not.toHaveBeenCalled();
    }
  );
  it.each([
    new EmailVerificationAuthenticationRequired('Denied'),
    new IdentityAuthenticationUnavailable('Private storage failure'),
  ])('withholds provider access when authority rejects: %s', async (error) => {
    authority.authorize.mockResolvedValue(err(error));
    expect((await service.status('token')).ok).toBe(false);
    expect((await service.request('token')).ok).toBe(false);
    expect(provider.status).not.toHaveBeenCalled();
    expect(provider.request).not.toHaveBeenCalled();
  });
  it('accepts credential action codes without establishing a session', async () => {
    expect(await service.verify('action_code')).toEqual(ok(undefined));
    expect(await service.complete('action_code')).toEqual(ok(undefined));
    expect(authority.authorize).not.toHaveBeenCalled();
  });
  it.each(['', 'bad/code', 'c'.repeat(2049)])(
    'rejects malformed action codes: %s',
    async (code) => {
      expect((await service.verify(code)).ok).toBe(false);
      expect((await service.complete(code)).ok).toBe(false);
      expect(provider.verify).not.toHaveBeenCalled();
      expect(provider.complete).not.toHaveBeenCalled();
    }
  );
  it.each([
    new EmailVerificationRejected('Expired'),
    new EmailVerificationThrottled('Wait'),
  ])('preserves known provider outcomes', async (error) => {
    provider.request.mockRejectedValue(error);
    expect(await service.request('token')).toEqual(err(error));
    expect(provider.request).toHaveBeenCalledTimes(1);
  });
  it('does not retry an uncertain delivery or disclose provider diagnostics', async () => {
    provider.request.mockRejectedValue(new Error('secret token'));
    const result = await service.request('token');
    expect(result).toEqual(
      err(
        new IdentityAuthenticationUnavailable('Email verification unavailable')
      )
    );
    expect(provider.request).toHaveBeenCalledTimes(1);
  });
});
