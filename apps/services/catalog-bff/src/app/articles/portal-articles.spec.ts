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
const fields = {
  title: 'Article title',
  slug: 'article-title',
  excerpt: 'A complete article summary.',
  byline: 'Public author',
  category: 'Guides',
  tags: ['tools'],
  sections: [{ heading: 'Section', paragraphs: ['A complete article body.'] }],
};
const at = 1000;
const draft = { ...fields, id, revision: 4, createdAt: at, updatedAt: at };
const publication = {
  id,
  revision: 4,
  publicationRevision: null,
  publishedSubmissionRevision: null,
  publicSlug: null,
  visible: false,
  latestSubmission: {
    ...fields,
    submittedRevision: 1,
    sourcePublicationRevision: null,
    submittedAt: at,
    reviewedAt: null,
    status: 'submitted',
    reason: '',
  },
};
const published = {
  ...fields,
  id,
  revision: 1,
  submittedRevision: 1,
  publishedAt: at,
  updatedAt: at,
};
const preview = Object.fromEntries(
  Object.entries(published).filter(([key]) => key !== 'sections')
);
const receipt = {
  id,
  revision: 5,
  action: 'approve',
  submittedRevision: 1,
  publicationRevision: 1,
};
const base = '/api/me/articles',
  reviews = '/api/editorial/article-reviews',
  catalog = '/api/catalog/articles';
const trusted = {
  'x-ingress-auth': 'article-test',
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
const create = fields;
const json = (res: ServerResponse, body: unknown, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
type Endpoint = [string, string, unknown?];
const endpoints: Endpoint[] = [
  ['GET', base],
  ['GET', `${base}/${id}`],
  ['POST', base, create],
  ['PUT', `${base}/${id}`, { ...fields, expectedRevision: 4 }],
  ['DELETE', `${base}/${id}`, { expectedRevision: 4 }],
  ['GET', `${base}/${id}/publication`],
  ['POST', `${base}/${id}/submit`, submit],
  ['POST', `${base}/${id}/withdraw`, submit],
  ['GET', reviews],
  ['GET', `${reviews}/${id}`],
  ['POST', `${reviews}/${id}/decision`, decision],
  ['GET', catalog],
  ['GET', catalog + '/' + fields.slug],
  ['GET', `/api/catalog/article-selection?ids=${id}`],
  ['GET', `/api/catalog/article-visibility/${id}`],
];
describe('article workflow through production BFF routes', () => {
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
      .slice(0, 11)
      .map(([method, path, body]) => [method, path, body] as const)
  )('requires a signed-in actor for %s %s', async (method, path, body) => {
    expect((await call(path, body, method, anonymous)).status).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each(
    endpoints.map(([method, path, body]) => [method, path, body] as const)
  )('rejects extra selectors for %s %s', async (method, path, body) => {
    expect(
      (
        await call(
          path + (path.includes('?') ? '&' : '?') + 'tenant=other',
          body,
          method
        )
      ).status
    ).toBe(400);
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
  it('returns bounded private lists and reads without inventing legacy fields', async () => {
    handler = (_req, res) => json(res, [draft]);
    const list = await call(base);
    expect(await list.json()).toEqual([draft]);
    expect(list.headers.get('cache-control')).toContain('no-store');
    handler = (_req, res) => json(res, draft);
    expect(await (await call(`${base}/${id}`)).json()).toEqual(draft);
  });
  it.each([
    ['POST', base, fields, { id, revision: 1, deleted: false }],
    [
      'PUT',
      `${base}/${id}`,
      { ...fields, expectedRevision: 4 },
      { id, revision: 5, deleted: false },
    ],
    [
      'DELETE',
      `${base}/${id}`,
      { expectedRevision: 4 },
      { id, revision: 5, deleted: true },
    ],
  ] as const)(
    'forwards %s %s once with the original key',
    async (method, path, body, result) => {
      handler = (_req, res) => json(res, result, method === 'POST' ? 201 : 200);
      const response = await call(path, body, method);
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(await response.json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(JSON.parse(observed[0].body)).toEqual(body);
      expect(observed[0].headers['idempotency-key']).toBe('stable-key');
    }
  );
  it.each([
    {},
    { classification: 'general' },
    {
      classification: 'mature',
      cover: { imageId: other, alt: 'Reviewed cover' },
    },
  ])(
    'preserves optional classification/cover and frozen submission %#',
    async (extra) => {
      const value = {
        ...publication,
        latestSubmission: { ...publication.latestSubmission, ...extra },
      };
      handler = (_req, res) => json(res, value);
      for (const path of [`${base}/${id}/publication`, `${reviews}/${id}`])
        expect(await (await call(path)).json()).toEqual(value);
      handler = (_req, res) =>
        json(res, { id, revision: 1, deleted: false }, 201);
      expect(
        (await call(base, { ...fields, ...extra, title: '  Article title  ' }))
          .status
      ).toBe(201);
      expect(JSON.parse(observed[2].body)).toEqual({ ...fields, ...extra });
    }
  );
  it.each(['submit', 'withdraw', 'approve', 'reject'] as const)(
    'forwards publication %s and both revisions',
    async (action) => {
      const review = action === 'approve' || action === 'reject';
      const body = review
        ? { ...decision, decision: action, reason: '  Independent review  ' }
        : submit;
      const result = {
        ...receipt,
        action,
        submittedRevision: action === 'submit' ? 4 : 1,
        publicationRevision: action === 'approve' ? 1 : null,
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
    'preserves review page %s',
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
    'serves all public read contracts with verified viewer %#',
    async (headers) => {
      for (const [path, value] of [
        [catalog, { items: [preview], page: 1, total: 1 }],
        [catalog + '/' + fields.slug, published],
        [
          `/api/catalog/article-selection?ids=${id},${other}`,
          { items: [preview] },
        ],
        [
          `/api/catalog/article-visibility/${id}`,
          { id, tenantId: 'tenant-a', revision: 1 },
        ],
      ] as const) {
        handler = (_req, res) => json(res, value);
        const response = await call(path, undefined, 'GET', headers);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(value);
      }
    }
  );
  it('preserves encoded filters, explicit page sizes and sorting', async () => {
    const value = { items: [preview], page: 2, pageSize: 3, total: 4 };
    handler = (_req, res) => json(res, value);
    const response = await call(
      catalog +
        '?q=Article%20%26%20title&category=Guides&tag=tools&page=2&pageSize=3&sort=name-desc'
    );
    expect(await response.json()).toEqual(value);
    expect(observed[0].url).toBe(
      catalog +
        '?q=Article+%26+title&category=Guides&tag=tools&page=2&pageSize=3&sort=name-desc'
    );
    handler = (_req, res) => json(res, { items: [], page: 10000, total: 0 });
    expect(await (await call(catalog + '?page=10000')).json()).toEqual({
      items: [],
      page: 10000,
      total: 0,
    });
  });
  it('deduplicates selected IDs and accepts unavailable items being omitted', async () => {
    handler = (_req, res) => json(res, { items: [] });
    expect(
      await (
        await call(`/api/catalog/article-selection?ids=${id},${id}`)
      ).json()
    ).toEqual({ items: [] });
    expect(observed[0].url).toBe(`/api/catalog/article-selection?ids=${id}`);
  });
  it('preserves owning-service title search semantics', async () => {
    const value = { items: [preview], page: 1, total: 1 };
    handler = (_req, res) => json(res, value);
    expect(
      await (await call(catalog + '?category=Guides&q=ARTICLE')).json()
    ).toEqual(value);
    expect(observed[0].url).toBe(
      catalog + '?q=ARTICLE&category=Guides&tag=&page=1'
    );
  });
  it('accepts valid multibyte content above 64 KiB and 100 drafts above 6 MiB', async () => {
    const large = {
      ...fields,
      sections: [
        {
          heading: '',
          paragraphs: Array.from({ length: 6 }, () => '\u754c'.repeat(3900)),
        },
      ],
    };
    expect(JSON.stringify(large).length).toBeLessThan(24000);
    expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(64 * 1024);
    handler = (_req, res) =>
      json(res, { id, revision: 1, deleted: false }, 201);
    expect((await call(base, large)).status).toBe(201);
    expect(JSON.parse(observed[0].body)).toEqual(large);
    const value = Array.from({ length: 100 }, (_, i) => ({
      ...draft,
      ...large,
      id: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    }));
    expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(
      6 * 1024 * 1024
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
    [{ ...draft, ownerIdentityId: 'private' }],
  ])('rejects malformed draft lists %#', async (value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(base)).status).toBe(503);
  });
  it.each([
    [`${base}/${id}`, { ...draft, id: other }],
    [`${base}/${id}/publication`, { ...publication, id: other }],
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
    [
      reviews,
      {
        items: [{ ...publication, latestSubmission: null }],
        page: 1,
        total: 1,
      },
    ],
    [catalog, { items: [published], page: 1, total: 1 }],
    [catalog, { items: [preview, preview], page: 1, total: 2 }],
    [catalog, { items: [preview], page: 2, total: 21 }],
    [catalog, { items: [preview], page: 1, total: 0 }],
    [catalog + '?pageSize=3', { items: [preview], page: 1, total: 1 }],
    [catalog + '?category=Other', { items: [preview], page: 1, total: 1 }],
    [catalog + '?tag=other', { items: [preview], page: 1, total: 1 }],
    [catalog + '/other', published],
    [catalog + '/' + fields.slug, { ...published, ownerIdentityId: 'private' }],
    [`/api/catalog/article-selection?ids=${other}`, { items: [preview] }],
    [`/api/catalog/article-selection?ids=${id}`, { items: [preview, preview] }],
    [
      `/api/catalog/article-visibility/${id}`,
      { id: other, tenantId: 'default', revision: 1 },
    ],
    [
      `/api/catalog/article-visibility/${id}`,
      { id, tenantId: '', revision: 1 },
    ],
    [
      `/api/catalog/article-visibility/${id}`,
      { id, tenantId: 'default', revision: 0 },
    ],
    [
      `/api/catalog/article-visibility/${id}`,
      { id, tenantId: 'default', revision: 1, owner: 'private' },
    ],
  ])('rejects mismatched downstream read %#', async (path, value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(String(path))).status).toBe(503);
  });
  it.each([
    'page=0',
    'page=10001',
    'page=01',
    'page=1&page=2',
    'page[x]=1',
    'pageSize=101',
    'pageSize=0',
    'pageSize[]=20',
    'sort=popular',
    'tag=Bad',
    'q[]=text',
    'category=x&category=y',
  ])('rejects browse query %s', async (query) => {
    expect((await call(catalog + '?' + query)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    `${base}/bad`,
    `${reviews}/bad`,
    reviews + '?page=10001',
    catalog + '/Bad-Slug',
    catalog + '/new',
    catalog + '/' + 'a'.repeat(101),
    '/api/catalog/article-selection',
    '/api/catalog/article-selection?ids=bad',
    `/api/catalog/article-selection?ids=${id}&ids=${other}`,
    '/api/catalog/article-selection?ids=' + Array(51).fill(id).join(','),
    '/api/catalog/article-visibility/bad',
  ])('rejects invalid selector %s', async (path) => {
    expect((await call(path)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    [base, { ...fields, ownerIdentityId: other }, 'POST'],
    [base, { ...fields, classification: 'unknown' }, 'POST'],
    [base, { ...fields, cover: null }, 'POST'],
    [base, { ...fields, cover: { imageId: other, alt: '' } }, 'POST'],
    [base, { ...fields, sections: [] }, 'POST'],
    [base, { ...fields, slug: 'Bad-Slug' }, 'POST'],
    [base, { ...fields, byline: '\ud800' }, 'POST'],
    [`${base}/${id}`, { ...fields, expectedRevision: '4' }, 'PUT'],
    [`${base}/${id}`, { expectedRevision: 4, title: 'extra' }, 'DELETE'],
    [`${base}/${id}/submit`, { expectedRevision: 4 }, 'POST'],
    [`${base}/${id}/submit`, { ...submit, submittedRevision: 1 }, 'POST'],
    [`${reviews}/${id}/decision`, { ...decision, decision: 'publish' }, 'POST'],
    [
      `${reviews}/${id}/decision`,
      { ...decision, submittedRevision: null },
      'POST',
    ],
    [
      `${reviews}/${id}/decision`,
      { ...decision, decision: 'reject', reason: ' ' },
      'POST',
    ],
  ] as const)(
    'rejects malformed command %# before transport',
    async (path, body, method) => {
      expect((await call(path, body, method)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    { ...receipt, id: other },
    { ...receipt, revision: 6 },
    { ...receipt, action: 'reject' },
    { ...receipt, submittedRevision: 2 },
    { ...receipt, publicationRevision: 2 },
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
      (await call(`${base}/${id}`, { ...fields, expectedRevision: 4 }, 'PUT'))
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
      [base, 200, 'application/json', 'x'.repeat(8 * 1024 * 1024 + 1)],
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
