import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import { HttpHealthProbe, isPublicHealthAddress } from './http-health-probe';

describe('Public HTTP health probe', () => {
  it('blocks private, loopback, metadata, mapped, transition and documentation addresses', () => {
    for (const ip of [
      '0.0.0.0',
      '10.0.0.1',
      '127.1.2.3',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '100.64.0.1',
      '192.0.2.1',
      '198.18.0.1',
      '203.0.113.1',
      '224.0.0.1',
      '255.255.255.255',
      '::1',
      '::',
      '::ffff:8.8.8.8',
      'fc00::1',
      'fe80::1',
      '2001:db8::1',
      '2002:808:808::1',
      '3fff::1',
      'bad',
    ])
      expect(isPublicHealthAddress(ip)).toBe(false);
    for (const ip of [
      '1.1.1.1',
      '8.8.8.8',
      '2606:4700:4700::1111',
      '2001:4860:4860::8888',
    ])
      expect(isPublicHealthAddress(ip)).toBe(true);
  });
  it('rejects mixed public/private DNS answers before opening a socket', async () => {
    const request = jest.fn();
    const probe = new HttpHealthProbe(
      async () => [
        { address: '1.1.1.1', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
      request
    );
    expect((await probe.observe('https://example.com/health')).reason).toBe(
      'blocked-target'
    );
    expect(request).not.toHaveBeenCalled();
  });
  it('pins a public address without pooling, redirects or forwarding credentials', async () => {
    let options: RequestOptions | undefined;
    const probe = new HttpHealthProbe(
      async () => [{ address: '1.1.1.1', family: 4 }],
      (_url, supplied, response) => {
        options = supplied;
        const stream = new EventEmitter() as ClientRequest;
        stream.end = jest.fn(() => {
          response({
            statusCode: 200,
            destroy: jest.fn(),
          } as unknown as IncomingMessage);
          return stream;
        });
        return stream;
      }
    );
    expect((await probe.observe('https://example.com/health')).status).toBe(
      'operational'
    );
    expect(options?.agent).toBe(false);
    expect(options?.method).toBe('GET');
    expect(options?.headers).toEqual({
      accept: '*/*',
      'user-agent': 'WappsHealth/1.0',
    });
    const callback = jest.fn();
    options?.lookup?.('example.com', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '1.1.1.1', 4);
  });
  it.each([
    [302, 'unknown', 'redirect'],
    [401, 'unknown', 'access-denied'],
    [403, 'unknown', 'access-denied'],
    [503, 'outage', 'http-error'],
  ])(
    'records HTTP %s truthfully without following it',
    async (code, status, reason) => {
      const probe = new HttpHealthProbe(
        async () => [{ address: '1.1.1.1', family: 4 }],
        (_url, _options, response) => {
          const stream = new EventEmitter() as ClientRequest;
          stream.end = jest.fn(() => {
            response({
              statusCode: code,
              destroy: jest.fn(),
            } as unknown as IncomingMessage);
            return stream;
          });
          return stream;
        }
      );
      expect(await probe.observe('https://example.com/health')).toMatchObject({
        status,
        reason,
        httpStatus: code,
      });
    }
  );
  it('keeps resolver and transport failures unknown', async () => {
    expect(
      (
        await new HttpHealthProbe(async () => {
          throw new Error();
        }).observe('https://example.com/')
      ).status
    ).toBe('unknown');
    const probe = new HttpHealthProbe(
      async () => [{ address: '1.1.1.1', family: 4 }],
      () => {
        const stream = new EventEmitter() as ClientRequest;
        stream.end = jest.fn(() => {
          stream.emit('error', new Error());
          return stream;
        });
        return stream;
      }
    );
    expect((await probe.observe('https://example.com/')).reason).toBe(
      'network-error'
    );
  });
});
