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
const base = `/api/me/application-drafts/${id}`;
const reviews = '/api/editorial/application-reviews';
const fields = {
  name: 'Work tools',
  slug: 'work-tools',
  website: 'https://example.test',
  description: 'Frozen application content for review.',
  classification: 'general',
};
const asset = {
  id: other,
  purpose: 'logo',
  contentType: 'image/webp',
  bytes: 100,
  sha256: 'a'.repeat(64),
  width: 16,
  height: 16,
};
const status = {
  id,
  revision: 4,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicSlug: null,
  latestSubmission: {
    ...fields,
    submittedRevision: 1,
    basePublicationRevision: null,
    status: 'submitted',
    submittedAt: 10,
    reviewedAt: null,
    reason: '',
    images: { logo: { kind: 'upload', asset }, banner: null },
  },
};
const receipt = {
  id,
  revision: 5,
  action: 'approve',
  submittedRevision: 1,
  publicationRevision: 1,
};
const trusted = {
  'x-ingress-auth': 'application-publication-test',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"roles":["staff"],"tenantId":"tenant-a","ignored":"private"}',
};
const json = (res: ServerResponse, body: unknown, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

describe('application publication through production BFF routes', () => {
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
        upstream.close((e) => (e ? reject(e) : resolve()))
      );
  });
  beforeEach(() => {
    observed.length = 0;
    config.EDITORIAL_URL = upstreamOrigin;
    handler = (_req, res) => json(res, status);
  });
  const call = (
    path: string,
    body?: unknown,
    headers: Record<string, string> = trusted
  ) =>
    fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...headers,
        ...(body === undefined
          ? {}
          : {
              'content-type': 'application/json',
              'idempotency-key': 'stable-key',
            }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const decision = {
    decision: 'approve',
    expectedRevision: 4,
    submittedRevision: 1,
  };
  const endpoints: [string, unknown][] = [
    [base + '/publication', undefined],
    [reviews, undefined],
    [reviews + '/' + id, undefined],
    [base + '/submit', { expectedRevision: 4 }],
    [base + '/withdraw', { expectedRevision: 4 }],
    [reviews + '/' + id + '/decision', decision],
  ];

  it.each([base + '/publication', reviews + '/' + id])(
    'preserves frozen status and image descriptors for %s',
    async (path) => {
      const result = await call(path);
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual(status);
      expect(result.headers.get('cache-control')).toContain('no-store');
      expect(observed[0].url).toBe(path);
    }
  );
  it.each([null, undefined])(
    'retains legacy image snapshot %s without inventing content',
    async (images) => {
      const legacy = {
        ...status,
        latestSubmission: { ...status.latestSubmission, images },
      };
      handler = (_req, res) => json(res, legacy);
      expect(await (await call(base + '/publication')).json()).toEqual(
        JSON.parse(JSON.stringify(legacy))
      );
    }
  );
  it('retains a stale editing binding for the owner to rebase, without requiring it to match public revision', async () => {
    const current = {
      ...status,
      publicationRevision: 8,
      publicSlug: fields.slug,
      editing: {
        applicationId: other,
        claimId: id,
        sourcePublicationRevision: 5,
      },
    };
    handler = (_req, res) => json(res, current);
    expect(await (await call(base + '/publication')).json()).toEqual(current);
  });
  it.each([undefined, '1', '2', '10000'])(
    'forwards bounded review page %s',
    async (page) => {
      const number = Number(page ?? 1),
        result = {
          items: [status],
          page: number,
          total: (number - 1) * 20 + 1,
        };
      handler = (_req, res) => json(res, result);
      const response = await call(reviews + (page ? '?page=' + page : ''));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(result);
      expect(observed[0].url).toBe(reviews + '?page=' + number);
    }
  );
  it('preserves a valid empty review page beyond the last result', async () => {
    const result = { items: [], page: 3, total: 1 };
    handler = (_req, res) => json(res, result);
    expect(await (await call(reviews + '?page=3')).json()).toEqual(result);
  });
  it.each(['submit', 'withdraw', 'approve', 'reject'] as const)(
    'forwards %s once with original key and revisions',
    async (action) => {
      const reviewing = action === 'approve' || action === 'reject';
      const body = reviewing
        ? {
            decision: action,
            expectedRevision: 4,
            submittedRevision: 1,
            reason: ' Review reason ',
          }
        : { expectedRevision: 4 };
      const result = {
        ...receipt,
        action,
        submittedRevision: action === 'submit' ? 4 : 1,
        publicationRevision: action === 'approve' ? 1 : null,
      };
      handler = (_req, res) => json(res, result, 201);
      const path = reviewing
        ? `${reviews}/${id}/decision`
        : `${base}/${action}`;
      const response = await call(path, body);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(result);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(path);
      expect(observed[0].method).toBe('POST');
      expect(observed[0].headers['idempotency-key']).toBe('stable-key');
      expect(JSON.parse(observed[0].body)).toEqual(
        reviewing ? { ...body, reason: 'Review reason' } : body
      );
    }
  );
  it('normalizes omitted approval reason without inventing other fields', async () => {
    handler = (_req, res) => json(res, receipt, 201);
    expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
      201
    );
    expect(JSON.parse(observed[0].body)).toEqual({ ...decision, reason: '' });
  });
  it.each(endpoints)(
    'requires verified signed-in identity at %s',
    async (path, body) => {
      const cases: [Record<string, string>, number][] = [
        [{}, 401],
        [{ ...trusted, 'x-ingress-auth': 'wrong' }, 401],
        [
          {
            'x-ingress-auth': trusted['x-ingress-auth'],
            'x-anonymous': 'true',
          },
          401,
        ],
        [
          {
            ...trusted,
            'x-user-claims': '{"tenantId":"tenant-a","roles":"staff"}',
          },
          400,
        ],
      ];
      for (const [headers, expected] of cases)
        expect((await call(path, body, headers)).status).toBe(expected);
      expect(observed).toHaveLength(0);
    }
  );
  it('forwards only allowed trusted context and leaves review authorization with Editorial', async () => {
    handler = (_req, res) => json(res, {}, 403);
    expect(
      (
        await call(`${reviews}/${id}/decision`, decision, {
          ...trusted,
          'x-user-claims': '{"roles":["member"],"tenantId":"tenant-a"}',
          authorization: 'Bearer private',
          cookie: 'private=value',
          'x-user-email': 'private@example.test',
          'x-auth-time': '123',
          'x-editorial-worker-token': 'private',
        })
      ).status
    ).toBe(403);
    const headers = observed[0].headers;
    expect(headers['x-user-id']).toBe('Alice');
    expect(JSON.parse(String(headers['x-user-claims']))).toEqual({
      roles: ['member'],
      tenantId: 'tenant-a',
    });
    for (const key of [
      'authorization',
      'cookie',
      'x-user-email',
      'x-auth-time',
      'x-editorial-worker-token',
    ])
      expect(headers[key]).toBeUndefined();
  });
  it.each([
    '0',
    '-1',
    '01',
    '1.5',
    '1e2',
    '10001',
    '99999',
    '',
    '1&page=2',
    '1&owner=Alice',
  ])('rejects invalid review selector %s', async (page) => {
    expect((await call(reviews + '?page=' + page)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each(endpoints.filter(([path]) => path !== reviews))(
    'rejects selectors on %s',
    async (path, body) => {
      expect((await call(path + '?tenantId=other', body)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    [base + '/submit', {}],
    [base + '/submit', { expectedRevision: '4' }],
    [base + '/submit', { expectedRevision: 0 }],
    [base + '/submit', { expectedRevision: 1.5 }],
    [base + '/submit', { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }],
    [base + '/submit', { expectedRevision: 4, submittedRevision: 1 }],
    [base + '/withdraw', { expectedRevision: 4, reason: 'ignored' }],
    [`${reviews}/${id}/decision`, { ...decision, decision: 'withdraw' }],
    [`${reviews}/${id}/decision`, { ...decision, submittedRevision: 0 }],
    [`${reviews}/${id}/decision`, { ...decision, ownerIdentityId: 'Alice' }],
    [`${reviews}/${id}/decision`, { ...decision, reason: 'a'.repeat(1001) }],
    [`${reviews}/${id}/decision`, { ...decision, reason: 'bad\u0000reason' }],
    [
      `${reviews}/${id}/decision`,
      { ...decision, decision: 'reject', reason: ' ' },
    ],
  ])('rejects invalid command at %s', async (path, body) => {
    expect((await call(String(path), body)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    'bad',
    '..%2Fsecret',
    '%2Fapi%2Finternal',
    '10000000-0000-4000-8000-00000000000z',
  ])('rejects malformed identifier %s', async (value) => {
    expect((await call(`${reviews}/${value}`)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('rejects duplicate command keys and read bodies before contacting Editorial', async () => {
    const raw = (
      method: string,
      path: string,
      headers: Record<string, string | string[]>
    ) =>
      new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          origin + path,
          {
            method,
            agent: false,
            headers: {
              ...trusted,
              'content-type': 'application/json',
              ...headers,
            },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode ?? 0));
          }
        );
        req.on('error', reject);
        req.end('{}');
      });
    expect(
      await raw('POST', base + '/submit', { 'idempotency-key': ['one', 'two'] })
    ).toBe(400);
    expect(
      await raw('GET', base + '/publication', { 'content-length': '2' })
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each(['', 'a'.repeat(129), 'with space', 'invalid/key'])(
    'rejects invalid command key %s',
    async (key) => {
      const response = await fetch(origin + base + '/submit', {
        method: 'POST',
        headers: {
          ...trusted,
          'content-type': 'application/json',
          'idempotency-key': key,
        },
        body: '{"expectedRevision":4}',
      });
      expect(response.status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    { ...status, id: other },
    { ...status, revision: 1 },
    { ...status, secret: 'internal' },
    { ...status, publicSlug: fields.slug },
    {
      ...status,
      latestSubmission: { ...status.latestSubmission, submittedRevision: 4 },
    },
    {
      ...status,
      latestSubmission: { ...status.latestSubmission, reviewedAt: 20 },
    },
    {
      ...status,
      latestSubmission: {
        ...status.latestSubmission,
        images: {
          logo: { kind: 'upload', asset: { ...asset, purpose: 'banner' } },
          banner: null,
        },
      },
    },
  ])('fails closed on malformed publication status %#', async (value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(base + '/publication')).status).toBe(503);
  });
  it.each([
    { items: [status], page: 2, total: 21 },
    { items: [status, status], page: 1, total: 2 },
    { items: Array(21).fill(status), page: 1, total: 21 },
    { items: [status], page: 1, total: 0 },
    { items: [status], page: 1, total: -1 },
    { items: [status], page: 1, total: 1, private: 'data' },
    { items: [{ ...status, latestSubmission: null }], page: 1, total: 1 },
  ])('fails closed on malformed review page %#', async (value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(reviews)).status).toBe(503);
  });
  it('rejects page contents beyond the reported total', async () => {
    handler = (_req, res) => json(res, { items: [status], page: 2, total: 20 });
    expect((await call(reviews + '?page=2')).status).toBe(503);
  });
  it.each([
    { ...receipt, id: other },
    { ...receipt, action: 'reject' },
    { ...receipt, revision: 6 },
    { ...receipt, submittedRevision: 2 },
    { ...receipt, publicationRevision: null },
    { ...receipt, internal: 'private' },
  ])('fails closed on mismatched command receipt %#', async (value) => {
    handler = (_req, res) => json(res, value, 201);
    expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
      503
    );
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502, 503])(
    'preserves safe owner error %s without internal details',
    async (code) => {
      handler = (_req, res) =>
        json(res, { message: 'secret database credentials' }, code);
      const response = await call(`${reviews}/${id}/decision`, decision);
      expect(response.status).toBe(code >= 500 ? 503 : code);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.text()).not.toContain('secret');
      expect(observed).toHaveLength(1);
      if (code >= 500 || code === 429)
        expect(response.headers.get('retry-after')).toBe('2');
    }
  );
  it('does not retry a lost reply; replay keeps the original command and returns its historical receipt', async () => {
    handler = (_req, res) => res.destroy();
    expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
      503
    );
    expect(observed).toHaveLength(1);
    handler = (_req, res) => json(res, receipt, 201);
    const result = await call(`${reviews}/${id}/decision`, decision);
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual(receipt);
    expect(observed).toHaveLength(2);
    expect(observed[1].body).toBe(observed[0].body);
    expect(observed[1].headers['idempotency-key']).toBe(
      observed[0].headers['idempotency-key']
    );
    expect(observed.every((r) => r.method === 'POST')).toBe(true);
  });
  it('bounds review responses, refuses redirects and rejects unexpected success status/media', async () => {
    for (const [code, type, value] of [
      [200, 'application/json', 'x'.repeat(2 * 1024 * 1024 + 1)],
      [302, 'application/json', {}],
      [201, 'application/json', status],
      [200, 'text/html', status],
    ] as const) {
      handler = (_req, res) => {
        res.writeHead(code, { 'content-type': type, location: '/internal' });
        res.end(JSON.stringify(value));
      };
      expect((await call(reviews)).status).toBe(503);
    }
    expect(observed).toHaveLength(4);
  });
  it('enforces a total publication command deadline without automatic retries', async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => timeout(30));
    handler = () => undefined;
    try {
      expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
        503
      );
      expect(spy).toHaveBeenCalledWith(15000);
      expect(observed).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
  it.each([
    reviews + '/' + id + '/unknown',
    reviews + '/' + id + '/decision/unknown',
    base + '/publish',
    base + '/submit/unknown',
  ])('does not proxy unknown path %s', async (path) => {
    expect((await call(path, decision)).status).toBe(404);
    expect(observed).toHaveLength(0);
  });
});
