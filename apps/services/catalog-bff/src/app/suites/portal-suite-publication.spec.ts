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
const ownerPath = `/api/me/suites/${id}`;
const reviews = '/api/editorial/suite-reviews';
const catalog = '/api/catalog/suites';
const selection = '/api/catalog/suite-selection';
const fields = {
  title: 'Tools',
  description: 'Frozen collection',
  applicationIds: [other, id],
  classification: 'general',
};
const status = {
  id,
  revision: 3,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  latestSubmission: {
    ...fields,
    submittedRevision: 1,
    status: 'submitted',
    submittedAt: 10,
    reviewedAt: null,
    reason: '',
  },
};
const publicSuite = {
  ...fields,
  id,
  revision: 1,
  submittedRevision: 1,
  publishedAt: 20,
};
const receipt = {
  id,
  revision: 4,
  action: 'approve',
  submittedRevision: 1,
  publicationRevision: 1,
};
const trusted = {
  'x-ingress-auth': 'publication-test-ingress',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"roles":["staff"],"tenantId":"tenant-a","ignored":"private"}',
};
const anonymous = {
  'x-ingress-auth': trusted['x-ingress-auth'],
  'x-anonymous': 'true',
};
const json = (res: ServerResponse, value: unknown, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
};
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

describe('suite publication through production BFF routes', () => {
  let app: INestApplication,
    upstream: Server,
    origin: string,
    upstreamOrigin: string,
    handler: Handler;
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
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
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
    handler = (_req, res) => json(res, status);
  });
  const call = (
    path = ownerPath + '/publication',
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ) =>
    fetch(origin + path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.headers ?? trusted),
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  const change = (
    path = `${reviews}/${id}/decision`,
    body: unknown = {
      decision: 'approve',
      expectedRevision: 3,
      submittedRevision: 1,
    },
    key = 'stable-key'
  ) =>
    call(path, {
      method: 'POST',
      body,
      headers: { ...trusted, 'idempotency-key': key },
    });

  it.each([
    [ownerPath + '/publication', status],
    [`${reviews}/${id}`, status],
    [reviews + '?page=1', { items: [status], page: 1, total: 1 }],
    [
      catalog + '?q=Tools&page=1&pageSize=3&sort=name-desc',
      { items: [publicSuite], page: 1, pageSize: 3, total: 1 },
    ],
    [`${catalog}/${id}`, publicSuite],
    [selection + '?ids=' + id, { items: [publicSuite] }],
  ])('preserves read contract %s', async (path, value) => {
    handler = (_req, res) => json(res, value);
    const response = await call(String(path));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(value);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(observed).toHaveLength(1);
    expect(observed[0].url).toBe(path);
    expect(observed[0].method).toBe('GET');
  });

  it.each(['submit', 'withdraw', 'approve', 'reject'] as const)(
    'preserves %s commands and receipts',
    async (action) => {
      const review = action === 'approve' || action === 'reject';
      const body = review
        ? {
            decision: action,
            expectedRevision: 3,
            submittedRevision: 1,
            reason: '  Reason  ',
          }
        : { expectedRevision: 3 };
      const result = {
        ...receipt,
        action,
        submittedRevision: action === 'submit' ? 3 : 1,
      };
      const path = review
        ? `${reviews}/${id}/decision`
        : `${ownerPath}/${action}`;
      handler = (_req, res) => json(res, result, 201);
      const response = await change(path, body);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(path);
      expect(observed[0].method).toBe('POST');
      expect(JSON.parse(observed[0].body)).toEqual(
        review ? { ...body, reason: 'Reason' } : body
      );
      expect(observed[0].headers['idempotency-key']).toBe('stable-key');
    }
  );

  it('accepts withdrawal without a pending submission and historical replay', async () => {
    handler = (_req, res) =>
      json(
        res,
        { ...receipt, action: 'withdraw', submittedRevision: null },
        201
      );
    expect(
      (await change(ownerPath + '/withdraw', { expectedRevision: 3 })).status
    ).toBe(201);
    handler = (_req, res) => json(res, receipt, 201);
    expect((await change()).status).toBe(201);
    expect((await change()).status).toBe(201);
    expect(observed.slice(1).map((r) => r.headers['idempotency-key'])).toEqual([
      'stable-key',
      'stable-key',
    ]);
  });

  it('normalizes defaults and preserves all supported public search controls', async () => {
    handler = (_req, res) => json(res, { items: [], page: 1, total: 0 });
    expect((await call(catalog)).status).toBe(200);
    expect(observed[0].url).toBe(catalog + '?q=&page=1');
    handler = (_req, res) =>
      json(res, { items: [], page: 4, pageSize: 100, total: 0 });
    expect(
      (await call(catalog + '?q=%20A%26B%20&page=4&pageSize=100&sort=newest'))
        .status
    ).toBe(200);
    expect(observed[1].url).toBe(
      catalog + '?q=A%26B&page=4&pageSize=100&sort=newest'
    );
    handler = (_req, res) => json(res, { items: [], page: 1, total: 0 });
    expect((await call(reviews)).status).toBe(200);
    expect(observed[2].url).toBe(reviews + '?page=1');
  });

  it('accepts a public selection subset in owner order and deduplicates requested IDs', async () => {
    handler = (_req, res) =>
      json(res, { items: [{ ...publicSuite, id: other }, publicSuite] });
    expect((await call(selection + `?ids=${id},${other},${id}`)).status).toBe(
      200
    );
    expect(observed[0].url).toBe(selection + `?ids=${id}%2C${other}`);
    handler = (_req, res) => json(res, { items: [] });
    expect((await call(selection + '?ids=' + id)).status).toBe(200);
  });

  it.each([catalog, `${catalog}/${id}`, selection + '?ids=' + id])(
    'permits only verified anonymous reads of %s',
    async (path) => {
      handler = (_req, res) =>
        json(
          res,
          path === catalog
            ? { items: [], page: 1, total: 0 }
            : path.startsWith(selection)
            ? { items: [] }
            : publicSuite
        );
      const response = await call(path, { headers: anonymous });
      expect(response.status).toBe(200);
      expect(response.headers.get('vary')).toBe('Authorization');
      expect(observed[0].headers['x-anonymous']).toBe('true');
      expect(observed[0].headers['x-user-id']).toBeUndefined();
      expect((await call(path, { headers: {} })).status).toBe(401);
      expect(
        (
          await call(path, {
            headers: { ...anonymous, authorization: 'Bearer client' },
          })
        ).status
      ).toBe(401);
      expect(observed).toHaveLength(1);
    }
  );

  it.each([
    ownerPath + '/publication',
    reviews,
    `${reviews}/${id}`,
    ownerPath + '/submit',
    ownerPath + '/withdraw',
    `${reviews}/${id}/decision`,
  ])('requires sign-in for %s', async (path) => {
    const command = /submit|withdraw|decision/.test(path);
    const response = await call(path, {
      headers: anonymous,
      ...(command ? { method: 'POST', body: { expectedRevision: 3 } } : {}),
    });
    expect(response.status).toBe(401);
    expect(observed).toHaveLength(0);
  });

  it('forwards only verified identity context and leaves staff authorization to Editorial', async () => {
    handler = (_req, res) => json(res, { internal: 'secret' }, 403);
    const response = await call(`${reviews}/${id}`, {
      headers: {
        ...trusted,
        authorization: 'Bearer private',
        cookie: 'session=private',
        'x-user-email': 'private@example.test',
        'x-auth-time': '123',
        'x-editorial-internal-auth': 'private',
      },
    });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('secret');
    const headers = observed[0].headers;
    expect(headers['x-user-id']).toBe('Alice');
    expect(JSON.parse(String(headers['x-user-claims']))).toEqual({
      roles: ['staff'],
      tenantId: 'tenant-a',
    });
    for (const key of [
      'authorization',
      'cookie',
      'x-user-email',
      'x-auth-time',
      'x-editorial-internal-auth',
    ])
      expect(headers[key]).toBeUndefined();
  });

  it.each([
    { ...trusted, 'x-ingress-auth': 'forged' },
    { ...trusted, 'x-user-id': '' },
    { ...trusted, 'x-user-claims': '{broken' },
    { ...trusted, 'x-user-claims': '{"roles":["staff"],"tenantId":123}' },
  ])(
    'rejects invalid provenance before contacting Editorial %j',
    async (headers) => {
      expect([400, 401]).toContain((await call(reviews, { headers })).status);
      expect(observed).toHaveLength(0);
    }
  );

  it.each([
    ownerPath + '/publication?owner=other',
    `${reviews}/${id}?tenantId=other`,
    reviews + '?page=0',
    reviews + '?page=10001',
    reviews + '?page=1&page=2',
    reviews + '?q=a',
    catalog + '?page=01',
    catalog + '?pageSize=101',
    catalog + '?sort=unknown',
    catalog + '?q=%00',
    catalog + '?q=' + 'x'.repeat(101),
    catalog + '?owner=other',
    `${catalog}/${id}?revision=1`,
    catalog + '/invalid-id',
    selection,
    selection + '?ids=invalid',
    selection + '?ids=' + Array(51).fill(id).join(','),
    selection + `?ids=${id}&ids=${other}`,
  ])('rejects invalid query/path %s', async (path) => {
    expect((await call(path)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each([
    [ownerPath + '/submit', { expectedRevision: 0 }],
    [ownerPath + '/submit', { expectedRevision: 3, submittedRevision: 1 }],
    [ownerPath + '/withdraw', { expectedRevision: 3, reason: 'extra' }],
    [ownerPath + '/submit?actor=other', { expectedRevision: 3 }],
    [
      `${reviews}/${id}/decision`,
      { decision: 'publish', expectedRevision: 3, submittedRevision: 1 },
    ],
    [
      `${reviews}/${id}/decision`,
      {
        decision: 'reject',
        expectedRevision: 3,
        submittedRevision: 1,
        reason: ' ',
      },
    ],
    [
      `${reviews}/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: 3,
        submittedRevision: 1,
        classification: 'general',
      },
    ],
    [
      `${reviews}/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: 3,
        submittedRevision: 1,
        reason: 'x'.repeat(1001),
      },
    ],
    [
      `${reviews}/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: 3,
        submittedRevision: 1,
        reason: '\u0000',
      },
    ],
    [`${reviews}/${id}/decision`, []],
    ['/api/me/suites/invalid/submit', { expectedRevision: 3 }],
  ])('rejects invalid command %s %j', async (path, body) => {
    expect((await change(String(path), body)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each(['', 'has space', 'x'.repeat(129)])(
    'rejects invalid command key %s',
    async (key) => {
      expect((await change(undefined, undefined, key)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );

  it('rejects duplicate keys and GET bodies', async () => {
    const raw = (
      method: string,
      path: string,
      headers: Record<string, string | string[]>,
      body = ''
    ) =>
      new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          origin + path,
          { method, headers: { ...trusted, ...headers } },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode ?? 0));
          }
        );
        req.on('error', reject);
        req.end(body);
      });
    expect(
      await raw(
        'POST',
        ownerPath + '/submit',
        {
          'idempotency-key': ['one', 'two'],
          'content-type': 'application/json',
        },
        '{"expectedRevision":3}'
      )
    ).toBe(400);
    expect(
      await raw(
        'GET',
        catalog,
        { 'content-type': 'application/json', 'content-length': '2' },
        '{}'
      )
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each([
    ownerPath + '/arbitrary',
    reviews + '/unknown/suffix',
    catalog + '/unknown/suffix',
    selection + '/extra',
  ])('does not proxy unimplemented suffix %s', async (path) => {
    expect((await call(path)).status).toBe(404);
    expect(observed).toHaveLength(0);
  });

  it('preserves case and trailing-slash matching without passing user paths downstream', async () => {
    const response = await call((ownerPath + '/publication/').toUpperCase());
    expect(response.status).toBe(200);
    expect(observed[0].url).toBe(ownerPath + '/publication');
  });

  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502, 503])(
    'maps owner failure %s without disclosing its body',
    async (code) => {
      handler = (_req, res) => json(res, { message: 'SQL secret' }, code);
      const response = await change();
      expect(response.status).toBe(code >= 500 ? 503 : code);
      expect(await response.text()).not.toContain('SQL secret');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      if (code >= 500 || code === 429)
        expect(response.headers.get('retry-after')).toBe('2');
      expect(observed).toHaveLength(1);
    }
  );

  it('does not retry a lost reply and preserves the key for an explicit replay', async () => {
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

  it.each([
    { ...receipt, id: other },
    { ...receipt, action: 'reject' },
    { ...receipt, revision: 3 },
    { ...receipt, submittedRevision: 2 },
    { ...receipt, publicationRevision: null },
    { ...receipt, owner: 'private' },
  ])('rejects mismatched approval receipt %j', async (value) => {
    handler = (_req, res) => json(res, value, 201);
    expect((await change()).status).toBe(503);
  });
  it('rejects mismatched submission and impossible withdrawal revisions', async () => {
    handler = (_req, res) => json(res, { ...receipt, action: 'submit' }, 201);
    expect(
      (await change(ownerPath + '/submit', { expectedRevision: 3 })).status
    ).toBe(503);
    handler = (_req, res) =>
      json(res, { ...receipt, action: 'withdraw', submittedRevision: 4 }, 201);
    expect(
      (await change(ownerPath + '/withdraw', { expectedRevision: 3 })).status
    ).toBe(503);
  });

  it.each([
    [ownerPath + '/publication', { ...status, id: other }],
    [
      `${reviews}/${id}`,
      {
        ...status,
        latestSubmission: { ...status.latestSubmission, submittedRevision: 3 },
      },
    ],
    [reviews + '?page=2', { items: [status], page: 2, total: 20 }],
    [reviews, { items: [status, status], page: 1, total: 2 }],
    [reviews, { items: [], page: 2, total: 0 }],
    [
      reviews,
      { items: [{ ...status, latestSubmission: null }], page: 1, total: 1 },
    ],
    [`${catalog}/${id}`, { ...publicSuite, id: other }],
    [`${catalog}/${id}`, { ...publicSuite, reason: 'private staff review' }],
    [
      catalog,
      {
        items: [{ ...publicSuite, ownerIdentityId: 'private' }],
        page: 1,
        total: 1,
      },
    ],
    [catalog, { items: [publicSuite, publicSuite], page: 1, total: 2 }],
    [catalog, { items: [], page: 2, total: 0 }],
    [catalog + '?pageSize=2', { items: [], page: 1, total: 0 }],
    [selection + '?ids=' + id, { items: [{ ...publicSuite, id: other }] }],
    [selection + '?ids=' + id, { items: [publicSuite, publicSuite] }],
  ])(
    'rejects malformed or incorrectly scoped read %s %j',
    async (path, value) => {
      handler = (_req, res) => json(res, value);
      expect((await call(String(path))).status).toBe(503);
    }
  );

  it.each([
    undefined,
    'file:///tmp/private',
    'https://user:secret@example.test',
    'http://localhost/prefix',
    'http://localhost?secret=value',
  ])('rejects invalid Editorial origin %s', async (value) => {
    config['EDITORIAL_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it('bounds response bytes, status and media, without following redirects', async () => {
    handler = (_req, res) => json(res, 'x'.repeat(1024 * 1024));
    expect((await call()).status).toBe(503);
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('{}');
    };
    expect((await call()).status).toBe(503);
    handler = (_req, res) => {
      res.writeHead(302, { location: upstreamOrigin + '/private' });
      res.end();
    };
    expect((await call()).status).toBe(503);
    handler = (_req, res) => json(res, receipt, 200);
    expect((await change()).status).toBe(503);
    expect(observed).toHaveLength(4);
  });
  it('bounds the total downstream deadline without retry', async () => {
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
