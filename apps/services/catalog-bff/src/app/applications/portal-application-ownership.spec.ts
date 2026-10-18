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
import { OWNERSHIP_CHALLENGE_LIFETIME } from '@domains/catalog/ownership';
import { AppModule } from '../app.module';

const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const claims = '/api/me/ownership-claims';
const reviews = '/api/editorial/ownership-reviews';
const input = {
  applicationId: other,
  evidenceUrl: 'https://example.test/team',
  notes: 'I maintain this application and its official website.',
};
const claim = {
  ...input,
  id,
  claimantIdentityId: 'Alice',
  revision: 3,
  applicationRevision: 1,
  applicationName: 'Work tools',
  applicationSlug: 'work-tools',
  website: 'https://example.test',
  hostname: 'example.test',
  challengeName: '_wapps-ownership.example.test',
  challengeValue: 'wapps-ownership=' + 'a'.repeat(64),
  status: 'awaiting-review',
  createdAt: 1000,
  updatedAt: 1002,
  expiresAt: 1000 + OWNERSHIP_CHALLENGE_LIFETIME,
  verifiedAt: 1001,
  reviewedAt: null,
  reason: '',
};
const reviewClaim = { ...claim, claimantIdentityId: 'Bob' };
const grantedClaim = { ...reviewClaim, status: 'approved', reviewedAt: 1002 };
const receipt = {
  id,
  revision: 4,
  action: 'approve',
  status: 'approved',
  proofMatched: null,
  applicationRevision: 2,
};
const decision = { decision: 'approve', expectedRevision: 3 };
const trusted = {
  'x-ingress-auth': 'ownership-test',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"roles":["staff"],"tenantId":"tenant-a","ignored":"private"}',
};
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const json = (res: ServerResponse, value: unknown, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
};
const endpoints: [string, unknown][] = [
  [claims, undefined],
  [`${claims}/${id}`, undefined],
  [claims, input],
  [`${claims}/${id}/verify`, { expectedRevision: 3 }],
  [`${claims}/${id}/cancel`, { expectedRevision: 3 }],
  [`${claims}/${id}/release`, { expectedRevision: 3 }],
  [reviews, undefined],
  [`${reviews}/${id}`, undefined],
  [`${reviews}/${id}/decision`, decision],
];

describe('application ownership through production BFF routes', () => {
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
    config.EDITORIAL_URL = upstreamOrigin;
    handler = (_req, res) => json(res, claim);
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
              'idempotency-key': 'ownership-original-key',
            }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  it.each([
    [`${claims}/${id}`, claim],
    [`${reviews}/${id}`, reviewClaim],
  ])(
    'preserves complete private proof and review details at %s',
    async (path, value) => {
      handler = (_req, res) => json(res, value);
      const response = await call(String(path));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual(value);
      expect(observed[0].url).toBe(path);
    }
  );
  it.each([
    [claims, claims + '?page=1', claim, 1, 1],
    [claims + '?page=2', claims + '?page=2', claim, 2, 21],
    [reviews, reviews + '?page=1&view=pending', reviewClaim, 1, 1],
    [
      reviews + '?page=2&view=pending',
      reviews + '?page=2&view=pending',
      reviewClaim,
      2,
      21,
    ],
    [
      reviews + '?view=grants',
      reviews + '?page=1&view=grants',
      grantedClaim,
      1,
      1,
    ],
  ] as const)(
    'preserves page and queue selectors at %s',
    async (path, downstream, item, page, total) => {
      const value = { items: [item], page, total };
      handler = (_req, res) => json(res, value);
      const response = await call(path);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(value);
      expect(observed[0].url).toBe(downstream);
    }
  );
  it('accepts the last bounded empty page', async () => {
    handler = (_req, res) => json(res, { items: [], page: 10000, total: 0 });
    expect((await call(claims + '?page=10000')).status).toBe(200);
  });
  it('creates with normalized fields and preserves the original key', async () => {
    const created = {
      ...receipt,
      revision: 1,
      action: 'create',
      status: 'awaiting-proof',
      applicationRevision: null,
    };
    handler = (_req, res) => json(res, created, 201);
    const response = await call(claims, {
      ...input,
      notes: '  ' + input.notes + '  ',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(created);
    expect(JSON.parse(observed[0].body)).toEqual(input);
    expect(observed[0].headers['idempotency-key']).toBe(
      'ownership-original-key'
    );
  });
  it.each([
    ['verify', 'awaiting-review', true, null],
    ['verify', 'awaiting-proof', false, null],
    ['cancel', 'cancelled', null, null],
    ['release', 'revoked', null, 3],
    ['approve', 'approved', null, 2],
    ['reject', 'rejected', null, null],
    ['revoke', 'revoked', null, 3],
  ] as const)(
    'forwards %s and validates its receipt without reading current state',
    async (action, status, proofMatched, applicationRevision) => {
      const review = ['approve', 'reject', 'revoke'].includes(action);
      const reason = ['approve', 'reject', 'revoke', 'release'].includes(action)
        ? { reason: 'Decision explanation' }
        : {};
      const body = {
        expectedRevision: 3,
        ...reason,
        ...(review ? { decision: action } : {}),
      };
      const path = `${review ? reviews : claims}/${id}/${
        review ? 'decision' : action
      }`;
      const value = {
        ...receipt,
        action,
        status,
        proofMatched,
        applicationRevision,
      };
      handler = (_req, res) => json(res, value, 201);
      const response = await call(path, body);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(value);
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(path);
      expect(JSON.parse(observed[0].body)).toEqual(body);
    }
  );
  it.each(endpoints)(
    'requires verified signed-in identity at %s',
    async (path, body) => {
      const cases: [Record<string, string>, number][] = [
        [{}, 401],
        [{ ...trusted, 'x-ingress-auth': 'forged' }, 401],
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
            'x-user-claims': '{"roles":"staff","tenantId":"tenant-a"}',
          },
          400,
        ],
      ];
      for (const [headers, status] of cases)
        expect((await call(path, body, headers)).status).toBe(status);
      expect(observed).toHaveLength(0);
    }
  );
  it('forwards only allowed trusted context and leaves resource/staff policy with Editorial', async () => {
    handler = (_req, res) => json(res, {}, 403);
    const response = await call(`${reviews}/${id}/decision`, decision, {
      ...trusted,
      'x-user-claims': '{"roles":["member"],"tenantId":"tenant-a"}',
      authorization: 'Bearer private',
      cookie: 'private=value',
      'x-user-email': 'private@example.test',
      'x-auth-time': '123',
      'x-editorial-worker-token': 'private',
    });
    expect(response.status).toBe(403);
    expect(observed[0].headers['x-user-id']).toBe('Alice');
    expect(JSON.parse(String(observed[0].headers['x-user-claims']))).toEqual({
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
      expect(observed[0].headers[key]).toBeUndefined();
  });
  it.each([
    '0',
    '-1',
    '01',
    '1.5',
    '1e2',
    '10001',
    '',
    '1&page=2',
    '1&owner=Alice',
    '1&view[]=pending',
  ])('rejects invalid page selectors %s', async (page) => {
    for (const path of [claims, reviews])
      expect((await call(path + '?page=' + page)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each(['', 'all', 'grants&view=pending', 'pending&tenantId=other'])(
    'rejects invalid staff view %s',
    async (view) => {
      expect((await call(reviews + '?view=' + view)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects review selectors on the private list', async () => {
    expect((await call(claims + '?view=grants')).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each(endpoints)('rejects extra selectors at %s', async (path, body) => {
    expect((await call(path + '?tenantId=other', body)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    [claims, {}],
    [claims, { ...input, claimantIdentityId: 'Bob' }],
    [claims, { ...input, website: 'https://attacker.test' }],
    [claims, { ...input, applicationId: 'invalid' }],
    [claims, { ...input, evidenceUrl: 'file:///tmp/test' }],
    [claims, { ...input, evidenceUrl: 'https://user:password@example.test' }],
    [claims, { ...input, notes: 'short' }],
    [claims, { ...input, notes: 'a'.repeat(2001) }],
    [claims, { ...input, notes: 'a'.repeat(30) + '\u0000' }],
    [`${claims}/${id}/verify`, { expectedRevision: '3' }],
    [`${claims}/${id}/verify`, { expectedRevision: 0 }],
    [`${claims}/${id}/verify`, { expectedRevision: 1.5 }],
    [
      `${claims}/${id}/verify`,
      { expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    ],
    [
      `${claims}/${id}/verify`,
      { expectedRevision: 3, hostname: 'attacker.test' },
    ],
    [`${claims}/${id}/verify`, { expectedRevision: 3, proofMatched: true }],
    [`${claims}/${id}/cancel`, { expectedRevision: 3, reason: 'ignored' }],
    [
      `${claims}/${id}/release`,
      { expectedRevision: 3, reason: 'a'.repeat(1001) },
    ],
    [`${reviews}/${id}/decision`, { ...decision, decision: 'release' }],
    [`${reviews}/${id}/decision`, { ...decision, ownerIdentityId: 'Alice' }],
    [
      `${reviews}/${id}/decision`,
      { ...decision, decision: 'reject', reason: '' },
    ],
    [
      `${reviews}/${id}/decision`,
      { ...decision, decision: 'revoke', reason: ' ' },
    ],
  ])('rejects malformed ownership command at %s', async (path, body) => {
    expect((await call(String(path), body)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    'invalid',
    '..%2Fsecret',
    '%2Fapi%2Finternal',
    '10000000-0000-4000-8000-00000000000z',
  ])('rejects identifier %s', async (value) => {
    for (const base of [claims, reviews])
      expect((await call(`${base}/${value}`)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each(['', 'a'.repeat(129), 'with space', 'invalid/key'])(
    'rejects invalid idempotency key %s',
    async (key) => {
      const response = await fetch(origin + claims, {
        method: 'POST',
        headers: {
          ...trusted,
          'content-type': 'application/json',
          'idempotency-key': key,
        },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects duplicate keys and read bodies', async () => {
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
      await raw('POST', claims, { 'idempotency-key': ['one', 'two'] })
    ).toBe(400);
    expect(await raw('GET', claims, { 'content-length': '2' })).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    { ...claim, id: other },
    { ...claim, claimantIdentityId: 'Bob' },
    { ...claim, hostname: 'other.test' },
    { ...claim, challengeName: '_wapps-ownership.other.test' },
    { ...claim, challengeValue: 'forged' },
    { ...claim, verifiedAt: null },
    { ...claim, expiresAt: claim.expiresAt + 1 },
    { ...claim, secret: 'private' },
  ])('rejects malformed or mismatched private claim %#', async (value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(`${claims}/${id}`)).status).toBe(503);
  });
  it('rejects a self-review record returned by upstream', async () => {
    expect((await call(`${reviews}/${id}`)).status).toBe(503);
  });
  it.each([
    { items: [reviewClaim], page: 2, total: 21 },
    { items: [reviewClaim, reviewClaim], page: 1, total: 2 },
    { items: Array(21).fill(reviewClaim), page: 1, total: 21 },
    { items: [reviewClaim], page: 1, total: 0 },
    { items: [claim], page: 1, total: 1 },
    { items: [grantedClaim], page: 1, total: 1 },
    { items: [reviewClaim], page: 1, total: -1 },
    { items: [reviewClaim], page: 1, total: 1, private: 'data' },
  ])('rejects invalid pending review page %#', async (value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(reviews)).status).toBe(503);
  });
  it('rejects unexpected owner, grant status and contents beyond page totals', async () => {
    handler = (_req, res) =>
      json(res, { items: [reviewClaim], page: 1, total: 1 });
    expect((await call(claims)).status).toBe(503);
    expect((await call(reviews + '?view=grants')).status).toBe(503);
    handler = (_req, res) => json(res, { items: [claim], page: 2, total: 20 });
    expect((await call(claims + '?page=2')).status).toBe(503);
  });
  it.each([
    { ...receipt, id: other },
    { ...receipt, revision: 5 },
    { ...receipt, action: 'revoke', status: 'revoked' },
    { ...receipt, applicationRevision: null },
    { ...receipt, proofMatched: true },
    { ...receipt, status: 'awaiting-proof' },
    { ...receipt, secret: 'private' },
  ])('rejects mismatched mutation receipt %#', async (value) => {
    handler = (_req, res) => json(res, value, 201);
    expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
      503
    );
  });
  it('rejects a non-creation receipt for create', async () => {
    handler = (_req, res) => json(res, receipt, 201);
    expect((await call(claims, input)).status).toBe(503);
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502, 503])(
    'preserves safe upstream status %s',
    async (status) => {
      handler = (_req, res) =>
        json(res, { message: 'secret credentials' }, status);
      const response = await call(`${claims}/${id}/verify`, {
        expectedRevision: 3,
      });
      expect(response.status).toBe(status >= 500 ? 503 : status);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.text()).not.toContain('secret');
      if (status === 429 || status >= 500)
        expect(response.headers.get('retry-after')).toBe('2');
      expect(observed).toHaveLength(1);
    }
  );
  it('does not retry lost responses and passes historical receipts without state preflight', async () => {
    handler = (_req, res) => res.destroy();
    expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
      503
    );
    expect(observed).toHaveLength(1);
    handler = (_req, res) => json(res, receipt, 201);
    const response = await call(`${reviews}/${id}/decision`, decision);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(receipt);
    expect(observed).toHaveLength(2);
    expect(observed[1]).toMatchObject({
      body: observed[0].body,
      method: 'POST',
      headers: { 'idempotency-key': observed[0].headers['idempotency-key'] },
    });
  });
  it('bounds response size and refuses redirects or unexpected response media/status', async () => {
    for (const [status, type, value] of [
      [200, 'application/json', 'x'.repeat(2 * 1024 * 1024 + 1)],
      [302, 'application/json', {}],
      [201, 'application/json', claim],
      [200, 'text/html', claim],
    ] as const) {
      handler = (_req, res) => {
        res.writeHead(status, { 'content-type': type, location: '/internal' });
        res.end(JSON.stringify(value));
      };
      expect((await call(`${claims}/${id}`)).status).toBe(503);
    }
    expect(observed).toHaveLength(4);
  });
  it('bounds verification by the existing total deadline with no automatic retries', async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => timeout(30));
    handler = () => undefined;
    try {
      expect(
        (await call(`${claims}/${id}/verify`, { expectedRevision: 3 })).status
      ).toBe(503);
      expect(spy).toHaveBeenCalledWith(15000);
      expect(observed).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
  it.each([
    undefined,
    'file:///tmp/editorial',
    'http://user:secret@editorial',
    'http://editorial/path',
    'http://editorial?key=secret',
  ])('fails safely for invalid service configuration %s', async (value) => {
    config.EDITORIAL_URL = value;
    expect((await call(claims)).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it.each([
    `${claims}/${id}/approve`,
    `${claims}/${id}/revoke`,
    `${claims}/${id}/verify/unknown`,
    `${reviews}/${id}/release`,
    `${reviews}/${id}/decision/unknown`,
  ])('does not proxy unknown route %s', async (path) => {
    expect((await call(path, decision)).status).toBe(404);
    expect(observed).toHaveLength(0);
  });
});
