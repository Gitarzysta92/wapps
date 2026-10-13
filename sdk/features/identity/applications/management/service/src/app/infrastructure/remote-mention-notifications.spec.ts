import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import { RemoteMentionNotifications } from './remote-mention-notifications';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const event = {
  id: id(2),
  discussionId: id(1),
  nodeId: id(1),
  recipientId: 'Owner',
  revision: 2,
  at: 100,
};
const target = {
  id: id(2),
  nodeId: id(1),
  discussionId: id(1),
  target: { kind: 'application', id: id(3) },
  title: 'Application',
  slug: 'application',
};
describe('bounded private notification source transport', () => {
  const secret = 'qualification-notification-secret-2026-only';
  let request: jest.SpyInstance;
  const adapter = () =>
    new RemoteMentionNotifications('http://discussion:1338', secret);
  const response = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  beforeEach(() => {
    request = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses a dedicated credential, deadline and redirect rejection for every operation', async () => {
    request
      .mockResolvedValueOnce(
        response({ lease: { event, token: id(4), until: 200 } })
      )
      .mockResolvedValueOnce(response({ items: [target] }))
      .mockResolvedValueOnce(response({ status: 'settled' }));
    expect(await adapter().claim()).toEqual({
      event,
      token: id(4),
      until: 200,
    });
    expect(await adapter().resolve('Owner', [id(2)])).toEqual([target]);
    await adapter().settle(id(2), id(4), false);
    expect(request).toHaveBeenCalledWith(
      'http://discussion:1338/api/internal/mention-notifications',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: {
          'content-type': 'application/json',
          'x-notification-worker': secret,
        },
      })
    );
    expect(
      request.mock.calls.map(([, init]) => JSON.parse(init.body).operation)
    ).toEqual(['claim', 'resolve', 'ack']);
  });
  it.each([
    { items: [target, target] },
    { items: [{ ...target, id: id(5) }] },
    { items: [target], secret: true },
    { items: [{ ...target, slug: '../private' }] },
  ])('rejects malformed or out-of-scope selections %j', async (value) => {
    request.mockResolvedValue(response(value));
    await expect(adapter().resolve('Owner', [id(2)])).rejects.toBeInstanceOf(
      CanonicalIdentityUnavailable
    );
  });
  it('rejects missing lease or acknowledgement values', async () => {
    request.mockResolvedValue(response({}));
    await expect(adapter().claim()).rejects.toBeInstanceOf(
      CanonicalIdentityUnavailable
    );
    await expect(adapter().settle(id(2), id(4), true)).rejects.toBeInstanceOf(
      CanonicalIdentityUnavailable
    );
  });
  it('accepts idle sources and superseded leases without new delivery', async () => {
    request
      .mockResolvedValueOnce(response({ lease: null }))
      .mockResolvedValueOnce(response({ status: 'superseded' }));
    expect(await adapter().claim()).toBeNull();
    await expect(adapter().settle(id(2), id(4), true)).resolves.toBeUndefined();
  });
  it.each([201, 301, 401, 409, 503])(
    'rejects unexpected HTTP status %s',
    async (status) => {
      request.mockResolvedValue(response({ lease: null }, status));
      await expect(adapter().claim()).rejects.toBeInstanceOf(
        CanonicalIdentityUnavailable
      );
    }
  );
  it('bounds response bytes and cancels the unread stream', async () => {
    const cancel = jest.fn();
    request.mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new Uint8Array(32_769));
          },
          cancel,
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    );
    await expect(adapter().claim()).rejects.toBeInstanceOf(
      CanonicalIdentityUnavailable
    );
    expect(cancel).toHaveBeenCalled();
  });
  it('does not send invalid or empty selections', async () => {
    expect(await adapter().resolve('Owner', [])).toEqual([]);
    expect(() => adapter().resolve('Owner', [id(2), id(2)])).toThrow();
    expect(() => adapter().resolve('', [id(2)])).toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('reports disabled delivery as unavailable even for an empty inbox', () => {
    const source = new RemoteMentionNotifications(
      'http://discussion:1338',
      secret,
      false
    );
    expect(() => source.resolve('Owner', [])).toThrow('not enabled');
    expect(request).not.toHaveBeenCalled();
  });
});
