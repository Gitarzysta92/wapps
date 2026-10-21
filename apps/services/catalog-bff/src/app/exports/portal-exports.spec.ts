import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ACCOUNT_EXPORT_LIMITS } from '@sdk/features/identity/core';
import { AppModule } from '../app.module';

const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const base = '/api/me/exports';
const trusted = {
  'x-ingress-auth': 'export-test-ingress',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"roles":["member"],"tenantId":"default","ignored":"private"}',
};
const queued = {
  id,
  status: 'queued',
  requestedAt: 10,
  expiresAt: 10 + ACCOUNT_EXPORT_LIMITS.retentionMs,
  readyAt: null,
  bytes: null,
  sha256: null,
  attempts: 0,
  failure: null,
};
const bytes = gzipSync('private archive\n');
const ready = {
  ...queued,
  status: 'ready',
  readyAt: 11,
  attempts: 1,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
const cancelled = { ...queued, status: 'cancelled' };
const json = (response: ServerResponse, value: unknown, status = 200) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
};
type Handler = (request: IncomingMessage, response: ServerResponse) => void;

describe('account exports through production BFF routes', () => {
  let app: INestApplication,
    upstream: Server,
    origin: string,
    upstreamOrigin: string;
  let handler: Handler;
  const config: Record<string, string | undefined> = {};
  const observed: {
    url: string | undefined;
    method: string | undefined;
    headers: IncomingMessage['headers'];
    body: string;
  }[] = [];
  beforeAll(async () => {
    upstream = createServer(async (request, response) => {
      const parts: Buffer[] = [];
      for await (const part of request) parts.push(Buffer.from(part));
      observed.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: Buffer.concat(parts).toString(),
      });
      handler(request, response);
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    upstreamOrigin = `http://127.0.0.1:${
      (upstream.address() as AddressInfo).port
    }`;
    Object.assign(config, {
      ACCOUNT_MANAGEMENT_URL: upstreamOrigin,
      EDITORIAL_URL: upstreamOrigin,
      INGRESS_AUTH_SECRET: trusted['x-ingress-auth'],
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => config[key] })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true })
    );
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
    upstream?.closeAllConnections();
    if (upstream)
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve()))
      );
  });
  beforeEach(() => {
    observed.length = 0;
    config['ACCOUNT_MANAGEMENT_URL'] = upstreamOrigin;
    config['INGRESS_AUTH_SECRET'] = trusted['x-ingress-auth'];
    handler = (request, response) => {
      if (request.url?.endsWith('/download')) {
        response.writeHead(200, {
          'content-type': 'application/gzip',
          'content-length': bytes.length,
        });
        response.end(bytes);
      } else if (request.method === 'POST') json(response, queued, 202);
      else if (request.method === 'DELETE') json(response, cancelled);
      else json(response, request.url === base ? { job: ready } : ready);
    };
  });
  const call = (
    path = base,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      signal?: AbortSignal;
    } = {}
  ) =>
    fetch(origin + path, {
      method: options.method ?? 'GET',
      headers: {
        ...trusted,
        ...options.headers,
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      signal: options.signal,
    });
  it.each([
    [base, 'GET', undefined, { job: ready }, 200],
    [base, 'POST', {}, queued, 202],
    [`${base}/${id}`, 'GET', undefined, ready, 200],
    [`${base}/${id}`, 'DELETE', undefined, cancelled, 200],
    [`${base.toUpperCase()}/${id}/`, 'DELETE', {}, cancelled, 200],
  ] as const)(
    'preserves %s %s semantics',
    async (path, method, body, expected, status) => {
      const response = await call(path, {
        method,
        body,
        headers: { 'idempotency-key': 'stable-command' },
      });
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(expected);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(observed).toHaveLength(1);
      expect(observed[0].method).toBe(method);
      expect(observed[0].url).toBe(
        method === 'DELETE' ? `${base}/${id}` : path
      );
      if (method === 'POST') {
        expect(observed[0].headers['idempotency-key']).toBe('stable-command');
        expect(observed[0].body).toBe('{}');
      }
    }
  );
  it('supports no previous export without fabricating a job', async () => {
    handler = (_request, response) => json(response, { job: null });
    expect(await (await call()).json()).toEqual({ job: null });
  });
  it.each([
    queued,
    { ...queued, status: 'building', attempts: 1 },
    ready,
    { ...queued, status: 'failed', attempts: 6, failure: 'source-unavailable' },
    cancelled,
    { ...queued, status: 'expired' },
  ])('preserves job lifecycle $status', async (job) => {
    handler = (_request, response) => json(response, job);
    const response = await call(`${base}/${id}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(job);
  });
  it('forwards only verified identity and no browser or worker credentials', async () => {
    await call(base, {
      headers: {
        authorization: 'Bearer private',
        cookie: 'private',
        'x-user-email': 'private@test.test',
        'x-auth-time': '1',
        'x-account-export-source': 'private',
        'x-notification-worker': 'private',
      },
    });
    expect(observed[0].headers).toMatchObject({
      'x-user-id': 'Alice',
      'x-ingress-auth': trusted['x-ingress-auth'],
      'x-anonymous': 'false',
    });
    expect(JSON.parse(String(observed[0].headers['x-user-claims']))).toEqual({
      roles: ['member'],
      tenantId: 'default',
    });
    for (const header of [
      'authorization',
      'cookie',
      'x-user-email',
      'x-auth-time',
      'x-account-export-source',
      'x-notification-worker',
    ])
      expect(observed[0].headers[header]).toBeUndefined();
  });
  it.each<Record<string, string>>([
    { 'x-ingress-auth': 'forged' },
    { 'x-user-id': '' },
    { 'x-anonymous': 'true' },
  ])('rejects untrusted or anonymous identity %j', async (headers) => {
    expect((await call(base, { headers })).status).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each([
    [base + '?identityId=Bob', 'GET', undefined, {}],
    [`${base}/invalid`, 'GET', undefined, {}],
    [`${base}/${id}/download?url=http://private`, 'GET', undefined, {}],
    [base, 'POST', { ownerId: 'Bob' }, { 'idempotency-key': 'key' }],
    [base, 'POST', [], { 'idempotency-key': 'key' }],
    [base, 'POST', {}, {}],
    [base, 'POST', {}, { 'idempotency-key': 'with space' }],
    [`${base}/${id}`, 'DELETE', { expectedRevision: 1 }, {}],
    [`${base}/${id}/download`, 'GET', undefined, { Range: 'bytes=0-2' }],
  ] as const)(
    'rejects invalid export input %s %s',
    async (path, method, body, headers) => {
      expect((await call(path, { method, body, headers })).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects duplicate command keys before contacting Account', async () => {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        origin + base,
        {
          method: 'POST',
          headers: {
            ...trusted,
            'content-type': 'application/json',
            'idempotency-key': ['one', 'two'],
          },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        }
      );
      request.on('error', reject);
      request.end('{}');
    });
    expect(status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('rejects HEAD downloads without opening an archive', async () => {
    expect(
      (await call(`${base}/${id}/download`, { method: 'HEAD' })).status
    ).toBe(405);
    expect(observed).toHaveLength(0);
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502])(
    'maps Account status %i without leaking diagnostics',
    async (status) => {
      handler = (_request, response) =>
        json(response, { secret: 'SQL private diagnostic' }, status);
      const response = await call();
      expect(response.status).toBe(status >= 500 ? 503 : status);
      expect(await response.text()).not.toContain('SQL private');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      if (status >= 500 || status === 429)
        expect(response.headers.get('retry-after')).toBe('2');
    }
  );
  it.each([
    undefined,
    'file:///private',
    'http://user:secret@localhost',
    'http://localhost/path',
  ])('fails closed for invalid origin %s', async (value) => {
    config['ACCOUNT_MANAGEMENT_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it.each([
    {},
    { job: ready, token: 'private' },
    { job: { ...ready, identityId: 'Bob' } },
    { job: { ...ready, bytes: ACCOUNT_EXPORT_LIMITS.archiveBytes + 1 } },
    { job: { ...ready, sha256: 'invalid' } },
    { job: { ...queued, bytes: 5 } },
  ])('rejects malformed status %j', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call()).status).toBe(503);
  });
  it('rejects status and cancellation responses for a different job', async () => {
    handler = (_request, response) =>
      json(response, { ...cancelled, id: other });
    for (const method of ['GET', 'DELETE'])
      expect((await call(`${base}/${id}`, { method })).status).toBe(503);
  });
  it('rejects a successful cancellation response that is still ready', async () => {
    handler = (_request, response) => json(response, ready);
    expect((await call(`${base}/${id}`, { method: 'DELETE' })).status).toBe(
      503
    );
  });
  it('preserves repeated request keys and current lifecycle, including cancellation', async () => {
    let value = queued;
    handler = (_request, response) => json(response, value, 202);
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        await (
          await call(base, {
            method: 'POST',
            body: {},
            headers: { 'idempotency-key': 'replay' },
          })
        ).json()
      ).toEqual(value);
    value = cancelled;
    expect(
      await (
        await call(base, {
          method: 'POST',
          body: {},
          headers: { 'idempotency-key': 'replay' },
        })
      ).json()
    ).toEqual(cancelled);
    expect(observed.map((item) => item.headers['idempotency-key'])).toEqual([
      'replay',
      'replay',
      'replay',
    ]);
  });
  it('does not retry a request whose response was lost', async () => {
    handler = (request) => request.socket.destroy();
    expect(
      (
        await call(base, {
          method: 'POST',
          body: {},
          headers: { 'idempotency-key': 'lost' },
        })
      ).status
    ).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it('does not follow redirects or accept oversized JSON', async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: upstreamOrigin + '/private' });
      response.end();
    };
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(1);
    handler = (_request, response) =>
      json(response, { job: 'x'.repeat(65537) });
    expect((await call()).status).toBe(503);
  });
  it('rechecks ownership for metadata and bytes and streams an exact safe attachment', async () => {
    const response = await call(`${base}/${id}/download`, {
      headers: { cookie: 'private', authorization: 'Bearer private' },
    });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get('content-type')).toBe('application/gzip');
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="wapps-account-${id}.ndjson.gz"`
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toContain(
      'sandbox'
    );
    expect(observed.map((item) => item.url)).toEqual([
      `${base}/${id}`,
      `${base}/${id}/download`,
    ]);
    for (const item of observed) {
      expect(item.headers['x-user-id']).toBe('Alice');
      expect(item.headers.authorization).toBeUndefined();
      expect(item.headers.cookie).toBeUndefined();
    }
  });
  it.each(['queued', 'building', 'cancelled', 'expired'])(
    'does not download %s archives',
    async (status) => {
      handler = (_request, response) =>
        json(response, { ...queued, status, attempts: 1 });
      expect((await call(`${base}/${id}/download`)).status).toBe(409);
      expect(observed).toHaveLength(1);
    }
  );
  it.each([403, 404, 409, 429, 500, 302])(
    'preserves download status %i after metadata succeeds and closes the response',
    async (status) => {
      handler = (request, response) => {
        if (!request.url?.endsWith('/download')) return json(response, ready);
        response.writeHead(status, {
          'content-type': 'text/plain',
          location: upstreamOrigin + '/private',
        });
        response.write('private internal data');
      };
      const response = await call(`${base}/${id}/download`);
      expect(response.status).toBe([302, 500].includes(status) ? 503 : status);
      expect(await response.text()).not.toContain('private internal data');
      expect(observed).toHaveLength(2);
    }
  );
  it.each([
    { 'content-type': 'application/json' },
    { 'content-encoding': 'gzip' },
    { 'content-length': String(bytes.length + 1) },
    { 'content-range': 'bytes 0-5/20' },
  ])('rejects invalid archive headers %j', async (headers) => {
    handler = (request, response) => {
      if (!request.url?.endsWith('/download')) return json(response, ready);
      response.writeHead(200, {
        'content-type': 'application/gzip',
        'content-length': bytes.length,
        ...headers,
      });
      response.end(bytes);
    };
    expect((await call(`${base}/${id}/download`)).status).toBe(503);
  });
  it('rejects a corrupt small archive before releasing any attachment', async () => {
    handler = (request, response) => {
      if (!request.url?.endsWith('/download'))
        return json(response, { ...ready, sha256: '0'.repeat(64) });
      response.writeHead(200, {
        'content-type': 'application/gzip',
        'content-length': bytes.length,
      });
      response.end(bytes);
    };
    const response = await call(`${base}/${id}/download`);
    expect(response.status).toBe(503);
    expect(response.headers.get('content-disposition')).toBeNull();
  });
  it('terminates a truncated archive instead of completing a partial download', async () => {
    const large = gzipSync(randomBytes(512 * 1024));
    handler = (request, response) => {
      if (!request.url?.endsWith('/download'))
        return json(response, {
          ...ready,
          bytes: large.length,
          sha256: createHash('sha256').update(large).digest('hex'),
        });
      response.writeHead(200, {
        'content-type': 'application/gzip',
        'content-length': large.length,
      });
      response.write(large.subarray(0, 256 * 1024));
      setTimeout(() => response.destroy(), 50);
    };
    const response = await call(`${base}/${id}/download`);
    if (response.status === 200)
      await expect(response.arrayBuffer()).rejects.toThrow();
    else expect(response.status).toBe(503);
  });
});
