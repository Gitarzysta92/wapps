import { IdentityAuthenticationService } from './identity-authentication.service';
import { Identity } from '@sdk/features/identity/core';
import { err, ok } from '@sdk/kernel/standard';

const session = {
  uid: 'firebase-uid',
  token: 'access',
  refreshToken: 'refresh',
  expiresIn: '3600',
  provider: 'google',
  claim: 'email@example.com',
  identityId: 'firebase-uid',
  kind: 'user',
  identityType: 'email',
};
const makeIdentity = (active = true) =>
  Identity.create({
    id: 'node',
    identityId: 'stable-wapps-id',
    claim: session.uid,
    kind: 'user',
    providerType: 'google',
    isActive: active,
    isSuspended: false,
    isDeleted: false,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
  });

function setup() {
  const provider = { obtainIdentity: jest.fn(), createIdentity: jest.fn() };
  const events = { publishAuthenticated: jest.fn() };
  const refresh = { refresh: jest.fn() };
  const service = new IdentityAuthenticationService(provider, events, refresh);
  const strategy = { execute: jest.fn().mockResolvedValue(ok(session)) };
  return { service, provider, events, refresh, strategy };
}

describe('Identity authentication', () => {
  it('does not return a session when durable authentication intent fails', async () => {
    const { service, provider, events, strategy } = setup();
    provider.obtainIdentity.mockResolvedValue(ok(makeIdentity()));
    events.publishAuthenticated.mockRejectedValue(new Error('SQL unavailable'));
    expect(await service.authenticate(strategy)).toEqual(
      err(new Error('Identity authentication could not be recorded'))
    );
  });
  it('denies unmapped credentials without inventing an identity', async () => {
    const { service, provider, events, strategy } = setup();
    provider.obtainIdentity.mockResolvedValue(ok(null));
    expect((await service.authenticate(strategy)).ok).toBe(false);
    expect(provider.createIdentity).not.toHaveBeenCalled();
    expect(events.publishAuthenticated).not.toHaveBeenCalled();
  });
  it('emits authentication for a returning identity without creating it again', async () => {
    const { service, provider, events, strategy } = setup();
    provider.obtainIdentity.mockResolvedValue(ok(makeIdentity()));
    expect((await service.authenticate(strategy)).ok).toBe(true);
    expect(provider.createIdentity).not.toHaveBeenCalled();
    expect(events.publishAuthenticated).toHaveBeenCalledTimes(1);
  });
  it('rejects inactive identities without emitting a success event', async () => {
    const { service, provider, events, strategy } = setup();
    provider.obtainIdentity.mockResolvedValue(ok(makeIdentity(false)));
    expect((await service.authenticate(strategy)).ok).toBe(false);
    expect(events.publishAuthenticated).not.toHaveBeenCalled();
  });
  it('does not treat a database failure as a missing identity', async () => {
    const { service, provider, strategy } = setup();
    provider.obtainIdentity.mockResolvedValue(
      err(new Error('database unavailable'))
    );
    expect((await service.authenticate(strategy)).ok).toBe(false);
    expect(provider.createIdentity).not.toHaveBeenCalled();
  });
  it('does not access identities when provider authentication fails', async () => {
    const { service, provider, strategy } = setup();
    strategy.execute.mockResolvedValue(err(new Error('invalid credentials')));
    expect((await service.authenticate(strategy)).ok).toBe(false);
    expect(provider.obtainIdentity).not.toHaveBeenCalled();
  });
  it('rejects refresh for an unavailable identity', async () => {
    const { service, provider, refresh } = setup();
    refresh.refresh.mockResolvedValue(ok(session));
    provider.obtainIdentity.mockResolvedValue(ok(makeIdentity(false)));
    expect((await service.refresh('refresh')).ok).toBe(false);
  });
  it('returns a refreshed session only for an available identity', async () => {
    const { service, provider, refresh } = setup();
    refresh.refresh.mockResolvedValue(ok(session));
    provider.obtainIdentity.mockResolvedValue(ok(makeIdentity()));
    expect(await service.refresh('refresh')).toEqual(
      ok({
        token: session.token,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        uid: 'stable-wapps-id',
      })
    );
  });
});
