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
const applicationId = '10000000-0000-4000-8000-000000000003';
const claimId = '10000000-0000-4000-8000-000000000004';
const fields = {
  version: '1.0.0+build_A-2',
  channel: 'stable',
  type: 'minor',
  releasedOn: '2026-01-01',
  title: 'Release notes',
  description: 'Approved release description.',
  changes: [{ type: 'feature', description: 'A new feature.' }],
};
const at = Date.parse('2026-01-02T00:00:00Z');
const target = {
  applicationId,
  releaseId: other,
  claimId,
  sourcePublicationRevision: null,
};
const draft = {
  ...fields,
  id,
  target,
  revision: 4,
  createdAt: at,
  updatedAt: at,
};
const publication = {
  application: { id: applicationId, name: 'Atlas', slug: 'atlas' },
  id,
  revision: 4,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicVersion: null,
  latestSubmission: {
    ...fields,
    target,
    submittedRevision: 1,
    submittedAt: at,
    reviewedAt: null,
    status: 'submitted',
    reason: '',
  },
};
const published = {
  ...fields,
  id: other,
  applicationId,
  applicationSlug: 'atlas',
  applicationName: 'Atlas',
  revision: 1,
  publishedAt: at,
};
const source = {
  applicationId,
  applicationName: 'Atlas',
  claimId,
  release: null,
};
const receipt = {
  id,
  revision: 5,
  releaseId: other,
  action: 'approve',
  submittedRevision: 1,
  publicationRevision: 1,
};
const base = '/api/me/releases';
const reviews = '/api/editorial/release-reviews';
const catalog = '/api/catalog/releases/atlas';
const trusted = {
  'x-ingress-auth': 'release-test',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"roles":["staff"],"tenantId":"tenant-a","ignored":"secret"}',
};
const anonymous = {
  'x-ingress-auth': trusted['x-ingress-auth'],
  'x-anonymous': 'true',
};
const decision = {
  decision: 'approve',
  expectedRevision: 4,
  expectedPublicationRevision: null,
  submittedRevision: 1,
};
const submit = { expectedRevision: 4, expectedPublicationRevision: null };
const create = { applicationId, claimId, fields };
const open = {
  applicationId,
  claimId,
  releaseId: other,
  expectedPublicationRevision: 1,
};
const json = (res: ServerResponse, body: unknown, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
type Endpoint = [string, string, unknown?];
const endpoints: Endpoint[] = [
  ['GET', base],
  ['GET', `${base}/source/${applicationId}`],
  ['GET', `${base}/${id}`],
  ['POST', base, create],
  ['POST', base + '/open', open],
  ['PUT', `${base}/${id}`, { expectedRevision: 4, fields }],
  ['POST', `${base}/${id}/rebase`, { ...submit, fields }],
  ['DELETE', `${base}/${id}`, { expectedRevision: 4 }],
  ['GET', `${base}/${id}/publication`],
  ['POST', `${base}/${id}/submit`, submit],
  ['POST', `${base}/${id}/withdraw`, submit],
  ['GET', reviews],
  ['GET', `${reviews}/${id}`],
  ['POST', `${reviews}/${id}/decision`, decision],
  ['GET', catalog],
  ['GET', catalog + '/' + encodeURIComponent(fields.version)],
];

describe('release workflow through production BFF routes', () => {
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
    config.INGRESS_AUTH_SECRET = trusted['x-ingress-auth'];
    handler = (_req, res) => json(res, draft);
  });
  const call = (
    path: string,
    body?: unknown,
    method = body === undefined ? 'GET' : 'POST',
    headers: Record<string, string> = trusted
  ) =>
    fetch(origin + path, {
      method,
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

  it.each(
    endpoints.map(([method, path, body]) => [method, path, body] as const)
  )('requires trusted provenance for %s %s', async (method, path, body) => {
    expect(
      (
        await call(path, body, method, {
          'x-user-id': 'Alice',
          'x-user-claims': '{"roles":["staff"]}',
        })
      ).status
    ).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each(
    endpoints
      .slice(0, 14)
      .map(([method, path, body]) => [method, path, body] as const)
  )('requires a signed-in actor for %s %s', async (method, path, body) => {
    expect((await call(path, body, method, anonymous)).status).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each(
    endpoints.map(([method, path, body]) => [method, path, body] as const)
  )('rejects extra selectors for %s %s', async (method, path, body) => {
    expect((await call(path + '?tenant=other', body, method)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('forwards only verified identity context and sanitizes claims', async () => {
    await call(`${base}/${id}`, undefined, 'GET', {
      ...trusted,
      authorization: 'Bearer browser-token',
      cookie: 'private=1',
      'x-service-key': 'private',
      'x-user-email': 'private@example.test',
    });
    expect(observed[0].headers['x-user-claims']).toBe(
      '{"tenantId":"tenant-a","roles":["staff"]}'
    );
    expect(observed[0].headers['x-user-id']).toBe('Alice');
    for (const key of [
      'authorization',
      'cookie',
      'x-service-key',
      'x-user-email',
    ])
      expect(observed[0].headers[key]).toBeUndefined();
  });
  it.each([null, '[]', '{', '{"roles":"staff"}', '{"tenantId":""}'])(
    'rejects malformed identity context %s',
    async (claims) => {
      expect(
        (
          await call(base, undefined, 'GET', {
            ...trusted,
            'x-user-claims': claims === null ? 'null' : claims,
          })
        ).status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects conflicting anonymous headers', async () => {
    expect(
      (
        await call(catalog, undefined, 'GET', {
          ...anonymous,
          'x-user-id': 'Alice',
        })
      ).status
    ).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it('returns private drafts with bound targets and no-store', async () => {
    handler = (_req, res) => json(res, [draft]);
    const list = await call(base);
    expect(await list.json()).toEqual([draft]);
    expect(list.headers.get('cache-control')).toContain('no-store');
    handler = (_req, res) => json(res, draft);
    expect(await (await call(`${base}/${id}`)).json()).toEqual(draft);
  });
  it.each([null, { ...fields, id: other, revision: 3, visible: false }])(
    'preserves canonical source including withdrawn version %#',
    async (release) => {
      const result = { ...source, release };
      handler = (_req, res) => json(res, result);
      const path =
        `${base}/source/${applicationId}` +
        (release ? '?releaseId=' + other : '');
      expect(await (await call(path)).json()).toEqual(result);
      expect(observed[0].url).toBe(path);
    }
  );
  it.each([
    ['create', base, create, 'POST', 1, false],
    ['open', base + '/open', open, 'POST', 1, false],
    [
      'update',
      `${base}/${id}`,
      { expectedRevision: 4, fields },
      'PUT',
      5,
      false,
    ],
    ['rebase', `${base}/${id}/rebase`, { ...submit, fields }, 'POST', 5, false],
    ['delete', `${base}/${id}`, { expectedRevision: 4 }, 'DELETE', 5, true],
  ] as const)(
    'forwards %s once with the original key and revision',
    async (_action, path, body, method, revision, deleted) => {
      const result = { id, revision, deleted };
      handler = (_req, res) => json(res, result, method === 'POST' ? 201 : 200);
      const response = await call(path, body, method);
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(await response.json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(observed[0]).toMatchObject({
        url: path,
        method,
        body: JSON.stringify(body),
      });
      expect(observed[0].headers['idempotency-key']).toBe('stable-key');
    }
  );
  it('normalizes fields while retaining release version punctuation', async () => {
    handler = (_req, res) =>
      json(res, { id, revision: 1, deleted: false }, 201);
    expect(
      (
        await call(base, {
          ...create,
          fields: { ...fields, title: '  Title  ' },
        })
      ).status
    ).toBe(201);
    expect(JSON.parse(observed[0].body).fields).toEqual({
      ...fields,
      title: 'Title',
    });
  });
  it.each([undefined, null, publication.application])(
    'preserves legacy application context %# and frozen submissions',
    async (application) => {
      const value = { ...publication, application };
      handler = (_req, res) => json(res, value);
      for (const path of [`${base}/${id}/publication`, `${reviews}/${id}`])
        expect(await (await call(path)).json()).toEqual(
          JSON.parse(JSON.stringify(value))
        );
    }
  );
  it.each(['submit', 'withdraw', 'approve', 'reject'] as const)(
    'preserves publication %s and both expected revisions',
    async (action) => {
      const review = action === 'approve' || action === 'reject';
      const body = review
        ? { ...decision, decision: action, reason: '  Independent review  ' }
        : submit;
      const result = {
        ...receipt,
        action,
        submittedRevision: action === 'submit' ? 4 : 1,
      };
      handler = (_req, res) => json(res, result, 201);
      const path = review
        ? `${reviews}/${id}/decision`
        : `${base}/${id}/${action}`;
      expect(await (await call(path, body)).json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(JSON.parse(observed[0].body)).toEqual(
        review ? { ...body, reason: 'Independent review' } : body
      );
    }
  );
  it.each([undefined, '1', '2', '10000'])(
    'preserves bounded review page %s',
    async (page) => {
      const number = Number(page ?? 1),
        value = {
          items: [publication],
          page: number,
          total: (number - 1) * 20 + 1,
        };
      handler = (_req, res) => json(res, value);
      expect(
        await (await call(reviews + (page ? '?page=' + page : ''))).json()
      ).toEqual(value);
      expect(observed[0].url).toBe(reviews + '?page=' + number);
    }
  );
  it.each([trusted, anonymous])(
    'serves public versions with verified viewer %# and correct encoding',
    async (headers) => {
      handler = (_req, res) => json(res, published);
      const path = catalog + '/' + encodeURIComponent(fields.version);
      const response = await call(path, undefined, 'GET', headers);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(published);
      expect(observed[0].url).toBe(path);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
  );
  it('preserves public browse filters and empty pages', async () => {
    const value = { items: [published], page: 1, total: 1 };
    handler = (_req, res) => json(res, value);
    expect(
      await (await call(catalog + '?channel=stable&before=2026-01-02')).json()
    ).toEqual(value);
    expect(observed[0].url).toBe(
      catalog + '?page=1&channel=stable&before=2026-01-02'
    );
    handler = (_req, res) => json(res, { items: [], page: 10000, total: 0 });
    expect(await (await call(catalog + '?page=10000')).json()).toEqual({
      items: [],
      page: 10000,
      total: 0,
    });
  });
  it('supports the full 255-character application slug', async () => {
    const slug = 'a'.repeat(255);
    handler = (_req, res) => json(res, { ...published, applicationSlug: slug });
    expect(
      (
        await call(
          `/api/catalog/releases/${slug}/` + encodeURIComponent(fields.version)
        )
      ).status
    ).toBe(200);
  });
  it('accepts a bounded 100-draft multibyte workspace above 2 MiB', async () => {
    const large = {
      ...fields,
      description: '\u754c'.repeat(4000),
      changes: Array.from({ length: 10 }, () => ({
        type: 'feature',
        description: '\u754c'.repeat(1000),
      })),
    };
    const value = Array.from({ length: 100 }, (_, i) => ({
      ...draft,
      ...large,
      id: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    }));
    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(
      2 * 1024 * 1024
    );
    handler = (_req, res) => json(res, value);
    const response = await call(base);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(value);
  });
  it.each([
    null,
    [draft, draft],
    Array(101).fill(draft),
    [{ ...draft, secret: 'internal' }],
  ])('rejects malformed draft lists %#', async (value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(base)).status).toBe(503);
  });
  it.each([
    [`${base}/${id}`, { ...draft, id: other }],
    [`${base}/source/${applicationId}`, { ...source, applicationId: other }],
    [`${base}/source/${applicationId}?releaseId=${other}`, source],
    [`${base}/${id}/publication`, { ...publication, id: other }],
    [
      `${base}/${id}/publication`,
      {
        ...publication,
        application: { ...publication.application, id: other },
      },
    ],
    [
      `${base}/${id}/publication`,
      {
        ...publication,
        latestSubmission: {
          ...publication.latestSubmission,
          submittedRevision: 4,
        },
      },
    ],
    [reviews, { items: [publication], page: 2, total: 21 }],
    [reviews, { items: [publication, publication], page: 1, total: 2 }],
    [reviews, { items: [publication], page: 1, total: 0 }],
    [
      reviews,
      {
        items: [{ ...publication, latestSubmission: null }],
        page: 1,
        total: 1,
      },
    ],
    [catalog, { items: [published], page: 2, total: 21 }],
    [catalog, { items: [published, published], page: 1, total: 2 }],
    [
      catalog,
      {
        items: [{ ...published, applicationSlug: 'other' }],
        page: 1,
        total: 1,
      },
    ],
    [
      catalog + '?channel=prerelease',
      { items: [published], page: 1, total: 1 },
    ],
    [catalog + '?before=2026-01-01', { items: [published], page: 1, total: 1 }],
    [catalog + '/2.0', published],
    [
      catalog + '/' + encodeURIComponent(fields.version),
      { ...published, claimId },
    ],
  ])(
    'fails closed on mismatched downstream contract %#',
    async (path, value) => {
      handler = (_req, res) => json(res, value);
      expect((await call(String(path))).status).toBe(503);
    }
  );
  it.each([
    'page=0',
    'page=10001',
    'page=01',
    'page=1&page=2',
    'page[x]=1',
    'channel=other',
    'channel=stable&channel=stable',
    'before=2026-02-30',
    'before=0000-01-01',
    'before[]=2026-01-01',
  ])('rejects malformed browse query %s', async (query) => {
    expect((await call(catalog + '?' + query)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    `${base}/bad-id`,
    `${base}/source/${applicationId}?releaseId=bad`,
    `${base}/source/${applicationId}?releaseId=${other}&releaseId=${other}`,
    `${reviews}/bad-id`,
    reviews + '?page=10001',
    catalog + '/v%2Fescape',
    '/api/catalog/releases/Bad-Slug',
    '/api/catalog/releases/' + 'a'.repeat(256),
  ])('rejects invalid path or selector %s', async (path) => {
    expect((await call(path)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    [base, { ...create, ownerIdentityId: other }],
    [base, { ...create, claimId: 'bad' }],
    [base, { ...create, fields: { ...fields, version: '../escape' } }],
    [base, { ...create, fields: { ...fields, changes: [] } }],
    [base + '/open', { ...open, expectedPublicationRevision: null }],
    [base + '/open', { ...open, fields }],
    [`${base}/${id}/rebase`, { expectedRevision: 4, fields }],
    [`${base}/${id}/submit`, { expectedRevision: 4 }],
    [`${base}/${id}/submit`, { ...submit, expectedRevision: '4' }],
    [`${base}/${id}/submit`, { ...submit, submittedRevision: 1 }],
    [`${reviews}/${id}/decision`, { ...decision, decision: 'publish' }],
    [`${reviews}/${id}/decision`, { ...decision, submittedRevision: null }],
    [
      `${reviews}/${id}/decision`,
      { ...decision, decision: 'reject', reason: ' ' },
    ],
  ])('rejects malformed command %# before transport', async (path, body) => {
    expect((await call(String(path), body)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    { ...receipt, id: other },
    { ...receipt, revision: 6 },
    { ...receipt, action: 'reject' },
    { ...receipt, submittedRevision: 2 },
    { ...receipt, publicationRevision: null },
    { ...receipt, internal: 'private' },
  ])('rejects mismatched publication receipt %#', async (value) => {
    handler = (_req, res) => json(res, value, 201);
    expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
      503
    );
  });
  it.each([
    { id: other, revision: 5, deleted: false },
    { id, revision: 4, deleted: false },
    { id, revision: 5, deleted: true },
  ])('rejects mismatched draft receipt %#', async (value) => {
    handler = (_req, res) => json(res, value);
    expect(
      (await call(`${base}/${id}`, { expectedRevision: 4, fields }, 'PUT'))
        .status
    ).toBe(503);
  });
  it.each(['', 'a'.repeat(129), 'bad/key', 'with space'])(
    'rejects invalid idempotency key %#',
    async (key) => {
      const response = await fetch(origin + base, {
        method: 'POST',
        headers: {
          ...trusted,
          'content-type': 'application/json',
          'idempotency-key': key,
        },
        body: JSON.stringify(create),
      });
      expect(response.status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects duplicate key headers and GET request bodies', async () => {
    const raw = (method: string, headers: Record<string, string | string[]>) =>
      new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          origin + base,
          {
            method,
            headers: {
              ...trusted,
              'content-type': 'application/json',
              ...headers,
            },
            agent: false,
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode ?? 0));
          }
        );
        req.on('error', reject);
        req.end('{}');
      });
    expect(await raw('POST', { 'idempotency-key': ['one', 'two'] })).toBe(400);
    expect(await raw('GET', { 'content-length': '2' })).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502, 503])(
    'maps downstream error %s without exposing internal data',
    async (code) => {
      handler = (_req, res) =>
        json(res, { message: 'secret database details' }, code);
      const response = await call(base);
      expect(response.status).toBe(code >= 500 ? 503 : code);
      expect(await response.text()).not.toContain('secret');
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(observed).toHaveLength(1);
      if (code === 429 || code >= 500)
        expect(response.headers.get('retry-after')).toBe('2');
    }
  );
  it('never retries a lost commit reply or preflights historical receipts', async () => {
    handler = (_req, res) => res.destroy();
    expect((await call(`${reviews}/${id}/decision`, decision)).status).toBe(
      503
    );
    expect(observed).toHaveLength(1);
    handler = (_req, res) => json(res, receipt, 201);
    expect(
      await (await call(`${reviews}/${id}/decision`, decision)).json()
    ).toEqual(receipt);
    expect(observed).toHaveLength(2);
    expect(observed[1].body).toBe(observed[0].body);
    expect(observed[1].headers['idempotency-key']).toBe(
      observed[0].headers['idempotency-key']
    );
  });
  it('enforces response byte bounds, status, media type and no redirects', async () => {
    for (const [path, code, type, value] of [
      [base, 200, 'application/json', 'x'.repeat(6 * 1024 * 1024 + 1)],
      [
        `${base}/${id}`,
        200,
        'application/json',
        'x'.repeat(2 * 1024 * 1024 + 1),
      ],
      [base, 302, 'application/json', {}],
      [base, 201, 'application/json', []],
      [base, 200, 'text/html', []],
    ] as const) {
      handler = (_req, res) => {
        res.writeHead(code, { 'content-type': type, location: '/private' });
        res.end(JSON.stringify(value));
      };
      expect((await call(path)).status).toBe(503);
    }
    expect(observed).toHaveLength(5);
  });
  it('enforces a total command deadline without retry', async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => timeout(30));
    handler = () => undefined;
    try {
      expect((await call(`${base}/${id}/submit`, submit)).status).toBe(503);
      expect(spy).toHaveBeenCalledWith(15000);
      expect(observed).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
  it.each([
    undefined,
    'file:///tmp/x',
    'https://user:pass@example.test',
    'http://example.test/path',
    'http://example.test?secret=x',
    'http://example.test/#fragment',
  ])('fails closed on invalid Editorial configuration %#', async (value) => {
    config.EDITORIAL_URL = value;
    expect((await call(base)).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it.each([
    `${base}/${id}/unknown`,
    `${base}/${id}/submit/unknown`,
    `${reviews}/${id}/decision/unknown`,
    catalog + '/v1/unknown',
  ])('does not proxy unknown suffix %s', async (path) => {
    expect((await call(path, submit)).status).toBe(404);
    expect(observed).toHaveLength(0);
  });
});
