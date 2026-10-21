import {
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { RemoteAccountErasureParticipant } from './remote-account-erasure-participant';

describe('remote account erasure participant', () => {
  const secret = 'qualification-erasure-secret-2026-only';
  const request = { identityId: 'Member', revision: 7 };
  const receipt = { ...request, participant: 'editorial', state: 'pending' };
  let fetchMock: jest.SpyInstance;
  const adapter = () =>
    new RemoteAccountErasureParticipant(
      'editorial',
      'http://editorial:1337',
      secret
    );
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  function response(body: unknown, status = 202) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
  it.each(['pending', 'completed'])(
    'accepts matching %s with strict status and service-only credentials',
    async (state) => {
      fetchMock.mockResolvedValue(
        response({ ...receipt, state }, state === 'completed' ? 200 : 202)
      );
      expect(await adapter().request(request)).toEqual({ ...receipt, state });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://editorial:1337/api/internal/account-erasure',
        expect.objectContaining({
          method: 'POST',
          redirect: 'error',
          signal: expect.any(AbortSignal),
          headers: {
            'content-type': 'application/json',
            'x-account-erasure-writer': secret,
          },
          body: JSON.stringify(request),
        })
      );
    }
  );
  it.each([
    { identityId: 'member' },
    { revision: 8 },
    { participant: 'discussion' },
    { state: 'completed' },
    { extra: true },
  ])('rejects mismatched or malformed receipts: %j', async (change) => {
    fetchMock.mockResolvedValue(response({ ...receipt, ...change }));
    await expect(adapter().request(request)).rejects.toBeInstanceOf(
      CanonicalIdentityUnavailable
    );
  });
  it.each([200, 204, 301, 401, 409, 503])(
    'rejects non-pending status %s for a pending receipt',
    async (status) => {
      fetchMock.mockResolvedValue(
        status === 204
          ? new Response(null, { status })
          : response(receipt, status)
      );
      await expect(adapter().request(request)).rejects.toBeInstanceOf(
        CanonicalIdentityUnavailable
      );
    }
  );
  it('bounds the response and cancels unread bytes', async () => {
    const cancel = jest.fn();
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new Uint8Array(4097));
          },
          cancel,
        }),
        { status: 202, headers: { 'content-type': 'application/json' } }
      )
    );
    await expect(adapter().request(request)).rejects.toBeInstanceOf(
      CanonicalIdentityUnavailable
    );
    expect(cancel).toHaveBeenCalled();
  });
  it('normalizes network failures without exposing connection details', async () => {
    fetchMock.mockRejectedValue(new Error('internal network detail'));
    await expect(adapter().request(request)).rejects.toThrow(
      'Account erasure participant unavailable'
    );
  });
  it('rejects invalid requests before transport', async () => {
    await expect(
      adapter().request({ ...request, revision: 0 })
    ).rejects.toBeInstanceOf(CanonicalIdentityInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    'file:///tmp',
    'https://user:secret@host',
    'http://host/api',
    'http://host/?x=1',
    'http://host/#fragment',
  ])('rejects unsafe service origin %s', (origin) => {
    expect(
      () => new RemoteAccountErasureParticipant('editorial', origin, secret)
    ).toThrow();
  });
  it('rejects weak credentials', () => {
    expect(
      () =>
        new RemoteAccountErasureParticipant('editorial', 'http://host', 'short')
    ).toThrow();
  });
});
