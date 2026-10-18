import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';

const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const base = '/api/me/suites';
const fields = {
  title: 'Work tools',
  description: 'My collection',
  applicationIds: [other, id],
  classification: 'general',
};
const suite = {
  ...fields,
  id,
  revision: 3,
  visibility: 'private',
  createdAt: 10,
  updatedAt: 20,
};
const receipt = { id, revision: 1, deleted: false };
const trusted = {
  'x-ingress-auth': 'suite-test-ingress',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"roles":["member"],"tenantId":"tenant-a","ignored":"private"}',
};
const json = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

describe('private suites through production BFF routes', () => {
  let app: INestApplication,
    upstream: Server,
    origin: string,
    upstreamOrigin: string;
  let handler: Handler;
  const config: Record<string, string | undefined> = {};
  const observed: {
    url?: string;
    method?: string;
    headers: IncomingMessage['headers'];
    body: string;
  }[] = [];

  beforeAll(async () => {
    upstream = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const part of req) chunks.push(Buffer.from(part));
      observed.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      handler(req, res);
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    upstreamOrigin = `http://127.0.0.1:${
      (upstream.address() as AddressInfo).port
    }`;
    Object.assign(config, {
      EDITORIAL_URL: upstreamOrigin,
      INGRESS_AUTH_SECRET: trusted['x-ingress-auth'],
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => config[key] })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
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
    config['EDITORIAL_URL'] = upstreamOrigin;
    config['INGRESS_AUTH_SECRET'] = trusted['x-ingress-auth'];
    handler = (req, res) => {
      if (req.method === 'POST') json(res, receipt, 201);
      else if (req.method === 'PUT' || req.method === 'DELETE')
        json(res, {
          ...receipt,
          revision: 4,
          deleted: req.method === 'DELETE',
        });
      else json(res, req.url === base ? [suite] : suite);
    };
  });
  const call = (
    path = base,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
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
    });
  const change = (body: unknown = fields, method = 'POST', key = 'command-1') =>
    call(method === 'POST' ? base : `${base}/${id}`, {
      method,
      body,
      headers: { 'idempotency-key': key },
    });

  it.each([
    [base, 'GET', undefined, [suite], 200],
    [`${base}/${id}`, 'GET', undefined, suite, 200],
    [base, 'POST', fields, receipt, 201],
    [
      `${base}/${id}`,
      'PUT',
      { ...fields, expectedRevision: 3 },
      { ...receipt, revision: 4 },
      200,
    ],
    [
      `${base}/${id}`,
      'DELETE',
      { expectedRevision: 3 },
      { ...receipt, revision: 4, deleted: true },
      200,
    ],
    [`${base.toUpperCase()}/${id}/`, 'GET', undefined, suite, 200],
  ] as const)(
    'preserves %s %s contract',
    async (path, method, body, result, status) => {
      const res = await call(path, {
        method,
        body,
        headers: { 'idempotency-key': 'stable-key' },
      });
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual(result);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(path.toLowerCase().replace(/\/$/, ''));
      expect(observed[0].method).toBe(method);
      if (body) {
        expect(JSON.parse(observed[0].body)).toEqual(body);
        expect(observed[0].headers['idempotency-key']).toBe('stable-key');
      }
    }
  );
  it('preserves ordered membership and mature classification proposals', async () => {
    await change({
      ...fields,
      applicationIds: [id, other],
      classification: 'mature',
    });
    expect(JSON.parse(observed[0].body)).toEqual({
      ...fields,
      applicationIds: [id, other],
      classification: 'mature',
    });
  });
  it('accepts unclassified legacy suites without inventing a classification', async () => {
    const { classification, ...legacy } = suite;
    expect(classification).toBe('general');
    handler = (_req, res) => json(res, legacy);
    const res = await call(`${base}/${id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(legacy);
  });
  it('preserves the empty workspace and maximum bounded workspace', async () => {
    handler = (_req, res) => json(res, []);
    expect(await (await call()).json()).toEqual([]);
    const rows = Array.from({ length: 100 }, (_, index) => ({
      ...suite,
      id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    handler = (_req, res) => json(res, rows);
    expect(await (await call()).json()).toEqual(rows);
  });
  it('forwards only verified identity/tenant/roles, without browser or worker credentials', async () => {
    await call(base, {
      headers: {
        authorization: 'Bearer secret',
        cookie: 'secret',
        'x-user-email': 'private@example.test',
        'x-auth-time': '1',
        'x-tenant-id': 'other',
        'x-roles': 'admin',
        'x-account-export-reader': 'secret',
        'x-notification-worker': 'secret',
        'x-profile-reader': 'secret',
      },
    });
    expect(observed[0].headers).toMatchObject({
      'x-user-id': 'Alice',
      'x-ingress-auth': trusted['x-ingress-auth'],
      'x-anonymous': 'false',
    });
    expect(JSON.parse(String(observed[0].headers['x-user-claims']))).toEqual({
      tenantId: 'tenant-a',
      roles: ['member'],
    });
    for (const name of [
      'authorization',
      'cookie',
      'x-user-email',
      'x-auth-time',
      'x-tenant-id',
      'x-roles',
      'x-account-export-reader',
      'x-notification-worker',
      'x-profile-reader',
    ])
      expect(observed[0].headers[name]).toBeUndefined();
  });
  it.each<Record<string, string>>([
    { 'x-ingress-auth': 'forged' },
    { 'x-user-id': '' },
    { 'x-anonymous': 'true' },
    { 'x-user-claims': 'not-json' },
    { 'x-user-claims': '[]' },
    { 'x-user-claims': '{"roles":[42]}' },
    { 'x-user-claims': '{"tenantId":42}' },
  ])(
    'rejects invalid trusted context %j before downstream work',
    async (headers) => {
      expect([400, 401]).toContain((await call(base, { headers })).status);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    `${base}?tenantId=other`,
    `${base}?page=2`,
    `${base}/bad-id`,
    `${base}/${id}?owner=Bob`,
  ])('rejects invalid selector %s', async (path) => {
    expect((await call(path)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    {},
    { ...fields, ownerIdentityId: 'Bob' },
    { ...fields, tenantId: 'other' },
    { ...fields, title: '' },
    { ...fields, title: 'x'.repeat(101) },
    { ...fields, description: 'x'.repeat(1001) },
    { ...fields, title: 'bad\u0000' },
    { ...fields, applicationIds: [] },
    { ...fields, applicationIds: [id, id] },
    { ...fields, applicationIds: ['bad-id'] },
    { ...fields, applicationIds: Array(51).fill(id) },
    { ...fields, classification: 'unreviewed' },
    { ...fields, expectedRevision: 1 },
  ])('rejects invalid create fields %j', async (body) => {
    expect((await change(body)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([undefined, 0, -1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid update revision %s',
    async (expectedRevision) => {
      expect(
        (await change({ ...fields, expectedRevision }, 'PUT')).status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects extra deletion fields and read bodies', async () => {
    expect(
      (await change({ expectedRevision: 3, title: 'extra' }, 'DELETE')).status
    ).toBe(400);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(
        origin + base,
        {
          headers: {
            ...trusted,
            'content-type': 'application/json',
            'content-length': '2',
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        }
      );
      req.on('error', reject);
      req.end('{}');
    });
    expect(status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each(['', 'spaces in key', 'x'.repeat(129), 'bad/key'])(
    'rejects invalid command key %s',
    async (key) => {
      expect((await change(fields, 'POST', key)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects duplicate command and identity headers', async () => {
    for (const name of ['Idempotency-Key', 'X-User-Id']) {
      const headers = Object.entries(trusted)
        .filter(([key]) => key !== name.toLowerCase())
        .flat();
      headers.push(
        name,
        'first',
        name,
        'second',
        'Content-Type',
        'application/json'
      );
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const req = httpRequest(
            origin + base,
            { method: 'POST', headers },
            (res) => {
              res.resume();
              resolve(res.statusCode);
            }
          );
          req.on('error', reject);
          req.end(JSON.stringify(fields));
        }
      );
      expect(status).toBe(400);
    }
    expect(observed).toHaveLength(0);
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502, 503])(
    'maps downstream %s without leaking internals or retrying',
    async (status) => {
      handler = (_req, res) =>
        json(res, { secret: 'private SQL or credentials' }, status);
      const res = await change();
      expect(res.status).toBe(status < 500 ? status : 503);
      expect(await res.text()).not.toContain('private SQL');
      expect(observed).toHaveLength(1);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      if (status === 429 || status >= 500)
        expect(res.headers.get('retry-after')).toBe('2');
    }
  );
  it('retains the exact request for caller retry after a committed response is lost', async () => {
    handler = (_req, res) => res.destroy();
    expect((await change()).status).toBe(503);
    expect(observed).toHaveLength(1);
    handler = (_req, res) => json(res, receipt, 201);
    expect(await (await change()).json()).toEqual(receipt);
    expect(observed).toHaveLength(2);
    expect(observed[1].body).toBe(observed[0].body);
    expect(observed[1].headers['idempotency-key']).toBe(
      observed[0].headers['idempotency-key']
    );
  });
  it('returns historical receipts without fabricating a current suite', async () => {
    handler = (req, res) =>
      req.method === 'POST' ? json(res, receipt, 201) : json(res, {}, 404);
    expect(await (await change()).json()).toEqual(receipt);
    expect((await call(`${base}/${id}`)).status).toBe(404);
  });
  it.each([
    null,
    {},
    [suite, suite],
    Array(101).fill(suite),
    [{ ...suite, visibility: 'public' }],
    [{ ...suite, ownerIdentityId: 'Bob' }],
    [{ ...suite, updatedAt: 1 }],
    [{ ...suite, applicationIds: [id, id] }],
  ])('rejects invalid upstream list %j', async (value) => {
    handler = (_req, res) => json(res, value);
    expect((await call()).status).toBe(503);
  });
  it('rejects another suite identity in a detail response', async () => {
    handler = (_req, res) => json(res, { ...suite, id: other });
    expect((await call(`${base}/${id}`)).status).toBe(503);
  });
  it.each([
    { ...receipt, id: other, revision: 4 },
    { ...receipt, revision: 3 },
    { ...receipt, revision: 4, deleted: true },
    { ...receipt, revision: 4, owner: 'Bob' },
  ])('rejects a mismatched update receipt %j', async (value) => {
    handler = (_req, res) => json(res, value);
    expect(
      (await change({ ...fields, expectedRevision: 3 }, 'PUT')).status
    ).toBe(503);
  });
  it('rejects an incomplete deletion receipt and unexpected create status', async () => {
    handler = (_req, res) => json(res, { ...receipt, revision: 4 });
    expect((await change({ expectedRevision: 3 }, 'DELETE')).status).toBe(503);
    handler = (_req, res) => json(res, receipt, 200);
    expect((await change()).status).toBe(503);
  });
  it.each([
    undefined,
    'file:///tmp/private',
    'https://user:password@example.test',
    'http://localhost/prefix',
    'http://localhost?secret=value',
  ])('rejects invalid Editorial origin %s', async (value) => {
    config['EDITORIAL_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it('bounds downstream bytes, rejects wrong media and never follows redirects', async () => {
    handler = (_req, res) => json(res, 'x'.repeat(1024 * 1024));
    expect((await call()).status).toBe(503);
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('[]');
    };
    expect((await call()).status).toBe(503);
    handler = (_req, res) => {
      res.writeHead(302, { location: upstreamOrigin + '/private' });
      res.end();
    };
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(3);
  });
  it('enforces a total downstream deadline without automatic retry', async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => timeout(30));
    handler = () => undefined;
    try {
      expect((await call()).status).toBe(503);
      expect(spy).toHaveBeenCalledWith(15_000);
      expect(observed).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
