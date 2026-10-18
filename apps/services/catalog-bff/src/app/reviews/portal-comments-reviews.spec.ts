import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';

const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const target = '10000000-0000-4000-8000-000000000003';
const third = '10000000-0000-4000-8000-000000000004';
const content = {
  displayName: 'Public Alice',
  text: 'A public comment',
  mentions: [other],
};
const post = {
  id,
  parentId: null,
  depth: 0,
  content,
  createdAt: 1000,
  updatedAt: null,
  editable: false,
  removable: false,
};
const thread = { id, revision: 4, replyCount: 0, comments: [post] };
const comments = { items: [thread], next: null };
const commentReceipt = {
  id,
  discussionId: id,
  revision: 5,
  projection: 'pending',
};
const reviewContent = {
  displayName: 'Public Alice',
  text: 'A useful application',
  rating: 4,
};
const summary = { total: 1, average: 4, distribution: [0, 0, 0, 1, 0] };
const review = {
  id,
  applicationId: target,
  revision: 4,
  contentRevision: 1,
  content: reviewContent,
  withdrawn: false,
  hidden: false,
  moderationReason: null,
  createdAt: 1000,
  updatedAt: 1000,
  helpfulCount: 1,
  helpful: true,
  reported: true,
  mine: false,
  canModerate: true,
  openReports: 1,
};
const reviews = {
  items: [review],
  next: null,
  summary,
  mine: null,
  canModerate: true,
};
const report = {
  id: other,
  reason: 'Incorrect description',
  content: reviewContent,
  contentRevision: 1,
  createdAt: 1001,
  resolution: 'open',
};
const reports = { items: [report], next: null };
const reviewReceipt = { id, revision: 5 };
const cbase = '/api/article-comments/' + target;
const rbase = '/api/application-reviews/' + target;
const trusted = {
  'x-ingress-auth': 'comments-reviews-test',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"tenantId":"tenant-a","roles":["admin"],"ignored":"secret"}',
};
const anonymous = {
  'x-ingress-auth': trusted['x-ingress-auth'],
  'x-anonymous': 'true',
};
const stableKey = 'stable-command-key-1234';
type Endpoint = [string, string, unknown?, unknown?];
const publicReads: Endpoint[] = [
  ['GET', cbase, undefined, comments],
  ['GET', `${cbase}/${id}`, undefined, thread],
  ['GET', rbase, undefined, reviews],
  ['GET', `${rbase}/summary`, undefined, summary],
  ['GET', `${rbase}/${id}`, undefined, review],
];
const privateReads: Endpoint[] = [
  ['GET', `${rbase}/moderation`, undefined, reviews],
  ['GET', `${rbase}/${id}/reports`, undefined, reports],
];
const changes: Endpoint[] = [
  ['POST', cbase, content, { ...commentReceipt, revision: 1 }],
  ['POST', `${cbase}/${id}/replies`, content, { ...commentReceipt, id: other }],
  ['PUT', `${cbase}/${id}`, { content, expectedRevision: 4 }, commentReceipt],
  ['DELETE', `${cbase}/${id}`, { expectedRevision: 4 }, commentReceipt],
  [
    'PUT',
    `${rbase}/mine`,
    { content: reviewContent, expectedRevision: 4 },
    reviewReceipt,
  ],
  ['DELETE', `${rbase}/${id}`, { expectedRevision: 4 }, reviewReceipt],
  [
    'PUT',
    `${rbase}/${id}/helpful`,
    { helpful: true, expectedRevision: 4 },
    reviewReceipt,
  ],
  [
    'POST',
    `${rbase}/${id}/reports`,
    { reason: 'Incorrect description', expectedRevision: 4 },
    reviewReceipt,
  ],
  [
    'PUT',
    `${rbase}/${id}/moderation`,
    { hidden: true, reason: 'Misleading', expectedRevision: 4 },
    reviewReceipt,
  ],
];
const endpoints = [...publicReads, ...privateReads, ...changes];
function ownerCommentFixture(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const row = input as Record<string, unknown>;
  if (Array.isArray(row.items))
    return {
      ...row,
      items: row.items.map(ownerCommentFixture),
      ...('mine' in row ? { mine: ownerCommentFixture(row.mine) } : {}),
    };
  if ('applicationId' in row) {
    const { applicationId, ...fields } = row;
    return { ...fields, bindingKey: 'wapps:application:' + applicationId };
  }
  return 'comments' in row
    ? { ...row, bindingKey: 'article:' + target, pinned: false, canPin: false }
    : input;
}
function ownerCommentPath(path: string) {
  const url = new URL(path, 'http://fixture.test');
  if (url.pathname.startsWith(rbase)) {
    const query = new URLSearchParams({
      bindingKey: 'wapps:application:' + target,
    });
    if (url.searchParams.has('cursor'))
      query.set('cursor', url.searchParams.get('cursor') as string);
    return '/api/reviews' + url.pathname.slice(rbase.length) + '?' + query;
  }
  if (!url.pathname.startsWith(cbase)) return path;
  const query = new URLSearchParams({ bindingKey: 'article:' + target });
  if (url.searchParams.has('cursor'))
    query.set('cursor', url.searchParams.get('cursor') as string);
  return (
    '/api/discussions' +
    url.pathname.slice(cbase.length).replace('/replies', '/comments') +
    '?' +
    query
  );
}
function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(ownerCommentFixture(value)));
}

describe('article comments and application reviews through the production BFF', () => {
  let app: INestApplication,
    upstream: Server,
    origin: string,
    upstreamOrigin: string;
  let handler: (request: IncomingMessage, response: ServerResponse) => void;
  const config: Record<string, string | undefined> = {};
  const observed: {
    url?: string;
    method?: string;
    headers: IncomingMessage['headers'];
    body: string;
  }[] = [];
  beforeAll(async () => {
    upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      observed.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: Buffer.concat(chunks).toString(),
      });
      handler(request, response);
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    upstreamOrigin = `http://127.0.0.1:${
      (upstream.address() as AddressInfo).port
    }`;
    config.DISCUSSION_URL = upstreamOrigin;
    config.EDITORIAL_URL = upstreamOrigin;
    config.INGRESS_AUTH_SECRET = trusted['x-ingress-auth'];
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
    config.DISCUSSION_URL = upstreamOrigin;
    config.INGRESS_AUTH_SECRET = trusted['x-ingress-auth'];
    handler = (_request, response) => json(response, {});
  });
  function call(
    path: string,
    body?: unknown,
    method = body === undefined ? 'GET' : 'POST',
    headers: Record<string, string> = trusted,
    key = stableKey
  ) {
    return fetch(origin + path, {
      method,
      headers: {
        ...headers,
        ...(body === undefined
          ? {}
          : { 'content-type': 'application/json', 'idempotency-key': key }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  it.each(endpoints)(
    'requires trusted provenance: %s %s',
    async (method, path, body) => {
      expect(
        (await call(path, body, method, { 'x-user-id': 'Alice' })).status
      ).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([...privateReads, ...changes])(
    'requires a member: %s %s',
    async (method, path, body) => {
      expect((await call(path, body, method, anonymous)).status).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each(endpoints)(
    'rejects extra selectors: %s %s',
    async (method, path, body) => {
      expect((await call(path + '?tenant=other', body, method)).status).toBe(
        400
      );
      expect(observed).toHaveLength(0);
    }
  );
  it.each(endpoints)(
    'preserves the complete contract: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) =>
        json(response, result, method === 'POST' ? 201 : 200);
      const response = await call(path, body, method);
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(ownerCommentPath(path));
      expect(observed[0].method).toBe(method);
      if (body !== undefined) {
        expect(JSON.parse(observed[0].body)).toEqual(
          method === 'POST' && path.startsWith(cbase)
            ? path === cbase
              ? { content: body, subjectId: target }
              : { content: body }
            : body
        );
        expect(observed[0].headers['idempotency-key']).toBe(stableKey);
      }
    }
  );
  it.each(publicReads)(
    'allows trusted anonymous reads: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) => json(response, result);
      expect((await call(path, body, method, anonymous)).status).toBe(200);
      expect(observed[0].headers['x-anonymous']).toBe('true');
      expect(observed[0].headers['x-user-id']).toBeUndefined();
    }
  );
  it.each([cbase, rbase])(
    'forwards only verified identity context: %s',
    async (path) => {
      await call(path, undefined, 'GET', {
        ...trusted,
        authorization: 'Bearer private',
        cookie: 'private=1',
        'x-user-email': 'secret@example.test',
        'x-notification-worker': 'secret',
      });
      expect(observed[0].headers['x-user-claims']).toBe(
        '{"tenantId":"tenant-a","roles":["admin"]}'
      );
      expect(observed[0].headers['x-user-id']).toBe('Alice');
      for (const name of [
        'authorization',
        'cookie',
        'x-user-email',
        'x-notification-worker',
      ])
        expect(observed[0].headers[name]).toBeUndefined();
    }
  );
  it.each([cbase, rbase])(
    'refuses conflicting anonymous identity: %s',
    async (path) => {
      expect(
        (
          await call(path, undefined, 'GET', {
            ...anonymous,
            'x-user-id': 'Alice',
          })
        ).status
      ).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([cbase, rbase])(
    'rejects duplicate trusted headers and read bodies: %s',
    async (path) => {
      for (const headers of [
        [
          'x-ingress-auth',
          trusted['x-ingress-auth'],
          'x-ingress-auth',
          trusted['x-ingress-auth'],
        ],
        [
          'x-ingress-auth',
          trusted['x-ingress-auth'],
          'x-user-id',
          'Alice',
          'content-length',
          '2',
        ],
      ]) {
        const status = await new Promise<number | undefined>(
          (resolve, reject) => {
            const request = httpRequest(
              origin + path,
              { method: 'GET', headers },
              (response) => {
                response.resume();
                resolve(response.statusCode);
              }
            );
            request.on('error', reject);
            request.end(headers.includes('content-length') ? '{}' : undefined);
          }
        );
        expect(status).toBe(400);
      }
      expect(observed).toHaveLength(0);
    }
  );
  it.each([cbase, rbase, `${rbase}/moderation`, `${rbase}/${id}/reports`])(
    'rejects malformed or repeated cursors: %s',
    async (path) => {
      for (const cursor of [
        'bad',
        '9007199254740992.' + id,
        '10.' + id.replace('4000', '4ABC'),
        '1.' + id + '&cursor=2.' + other,
        '1.' + id + '/extra',
      ]) {
        expect((await call(path + '?cursor=' + cursor)).status).toBe(400);
      }
      expect(observed).toHaveLength(0);
    }
  );
  it.each([cbase, rbase, `${rbase}/moderation`, `${rbase}/${id}/reports`])(
    'encodes and preserves cursors: %s',
    async (path) => {
      const result =
        path === cbase
          ? comments
          : path.endsWith('/reports')
          ? reports
          : reviews;
      handler = (_request, response) => json(response, result);
      expect((await call(path + '?cursor=1000.' + id)).status).toBe(200);
      expect(observed[0].url).toBe(
        ownerCommentPath(path + '?cursor=1000.' + id)
      );
    }
  );
  it('preserves leading-zero comment cursors without weakening review cursors', async () => {
    handler = (_request, response) => json(response, comments);
    expect((await call(cbase + '?cursor=0000.' + id)).status).toBe(200);
    expect(observed[0].url).toBe(
      ownerCommentPath(cbase + '?cursor=0000.' + id)
    );
    expect((await call(rbase + '?cursor=0000.' + id)).status).toBe(400);
  });
  it.each(changes)(
    'rejects invalid or missing command fields: %s %s',
    async (method, path, body) => {
      for (const invalid of [
        null,
        [],
        {},
        { ...(body as object), ownerId: 'secret' },
      ])
        expect((await call(path, invalid, method)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('keeps the two idempotency-key grammars distinct', async () => {
    handler = (_request, response) =>
      json(response, { ...commentReceipt, revision: 1 }, 201);
    expect((await call(cbase, content, 'POST', trusted, 'a.b:c')).status).toBe(
      201
    );
    for (const key of ['', 'short', '1234567890123456.bad', 'k'.repeat(129)])
      expect(
        (
          await call(
            `${rbase}/mine`,
            { content: reviewContent, expectedRevision: 0 },
            'PUT',
            trusted,
            key
          )
        ).status
      ).toBe(400);
    for (const key of ['', 'invalid key', 'k'.repeat(129)])
      expect((await call(cbase, content, 'POST', trusted, key)).status).toBe(
        400
      );
    expect(observed).toHaveLength(1);
  });
  it('validates comment limits and review ratings, booleans and reasons before dispatch', async () => {
    for (const body of [
      { ...content, text: 'a'.repeat(4001) },
      { ...content, displayName: 'a'.repeat(81) },
      { ...content, mentions: [other, other] },
      { ...content, title: 'not a topic' },
    ])
      expect((await call(cbase, body)).status).toBe(400);
    for (const body of [
      { content: { ...reviewContent, rating: 6 }, expectedRevision: 0 },
      {
        content: { ...reviewContent, text: 'a'.repeat(6001) },
        expectedRevision: 0,
      },
      { content: reviewContent, expectedRevision: -1 },
    ])
      expect((await call(`${rbase}/mine`, body, 'PUT')).status).toBe(400);
    expect(
      (
        await call(
          `${rbase}/${id}/helpful`,
          { helpful: 'true', expectedRevision: 4 },
          'PUT'
        )
      ).status
    ).toBe(400);
    expect(
      (
        await call(`${rbase}/${id}/reports`, {
          reason: ' ',
          expectedRevision: 4,
        })
      ).status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('preserves redacted comments and descendants', async () => {
    const value = {
      ...thread,
      replyCount: 2,
      comments: [
        post,
        {
          ...post,
          id: other,
          parentId: id,
          depth: 1,
          content: null,
          createdAt: null,
        },
        { ...post, id: third, parentId: other, depth: 2 },
      ],
    };
    handler = (_request, response) => json(response, value);
    expect(await (await call(`${cbase}/${id}`)).json()).toEqual(value);
  });
  it.each([
    null,
    {},
    { ...thread, id: other },
    { ...thread, ownerId: 'secret' },
    { ...thread, comments: [] },
    { ...thread, comments: [post, post] },
    { ...thread, replyCount: 1 },
    { ...thread, revision: 0 },
    { ...thread, comments: [{ ...post, content: null }] },
    { ...thread, comments: [{ ...post, votes: { mine: 0 } }] },
    {
      ...thread,
      replyCount: 1,
      comments: [post, { ...post, id: other, parentId: other, depth: 1 }],
    },
    {
      ...thread,
      replyCount: 1,
      comments: [post, { ...post, id: other, parentId: id, depth: 65 }],
    },
    {
      ...thread,
      replyCount: 1,
      comments: [
        post,
        {
          ...post,
          id: other,
          parentId: id,
          depth: 1,
          content: null,
          createdAt: null,
          editable: true,
        },
      ],
    },
  ])('fails closed on malformed comment thread %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(`${cbase}/${id}`)).status).toBe(503);
  });
  it('validates comment page bounds and continuation against the final root', async () => {
    const items = Array.from({ length: 10 }, (_, i) => {
      const rootId =
        '10000000-0000-4000-8000-' + String(i + 1).padStart(12, '0');
      return { ...thread, id: rootId, comments: [{ ...post, id: rootId }] };
    });
    handler = (_request, response) =>
      json(response, { items, next: '1000.' + items[9].id });
    expect((await call(cbase)).status).toBe(200);
    for (const value of [
      { items, next: '1000.' + id },
      { items: [thread, thread], next: null },
      { items: [...items, thread], next: null },
      { items: [thread], next: '1000.' + id },
    ]) {
      handler = (_request, response) => json(response, value);
      expect((await call(cbase)).status).toBe(503);
    }
  });
  it.each([
    null,
    {},
    { ...review, id: other },
    { ...review, applicationId: other },
    { ...review, ownerId: 'secret' },
    { ...review, contentRevision: 5 },
    { ...review, updatedAt: 999 },
    { ...review, helpfulCount: 0 },
    { ...review, mine: true },
    { ...review, hidden: 'false' },
    { ...review, content: { ...reviewContent, rating: 7 } },
  ])('fails closed on malformed member review %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(`${rbase}/${id}`)).status).toBe(503);
  });
  it.each([
    {
      items: [review, review],
      next: null,
      mine: null,
      summary,
      canModerate: true,
    },
    { ...reviews, items: [{ ...review, hidden: true }] },
    { ...reviews, items: [{ ...review, withdrawn: true }] },
    { ...reviews, next: '1000.' + id },
    { ...reviews, mine: review },
    { ...reviews, summary: { ...summary, average: 5 } },
  ])('fails closed on malformed review listing %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(rbase)).status).toBe(503);
  });
  it('preserves private own slots and moderator visibility without inventing public ratings', async () => {
    const hidden = {
      ...review,
      hidden: true,
      withdrawn: true,
      mine: true,
      helpful: false,
      reported: false,
      canModerate: false,
    };
    const value = {
      ...reviews,
      items: [],
      mine: hidden,
      summary: { total: 0, average: null, distribution: [0, 0, 0, 0, 0] },
    };
    handler = (_request, response) => json(response, value);
    expect(await (await call(rbase)).json()).toEqual(value);
    const moderation = { ...value, items: [hidden] };
    handler = (_request, response) => json(response, moderation);
    expect(await (await call(`${rbase}/moderation`)).json()).toEqual(
      moderation
    );
    handler = (_request, response) =>
      json(response, { ...moderation, canModerate: false });
    expect((await call(`${rbase}/moderation`)).status).toBe(503);
  });
  it.each([
    { ...summary, total: 2 },
    { ...summary, average: 0 },
    { total: 0, average: 0, distribution: [0, 0, 0, 0, 0] },
    { ...summary, distribution: [1] },
    { ...summary, internal: 'secret' },
  ])('rejects invented or inconsistent ratings %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(`${rbase}/summary`)).status).toBe(503);
  });
  it.each([
    { items: [report, report], next: null },
    { items: [{ ...report, reporterId: 'secret' }], next: null },
    { items: [{ ...report, resolution: 'unknown' }], next: null },
    { ...reports, next: '1000.' + id },
  ])('rejects malformed or private report data %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(`${rbase}/${id}/reports`)).status).toBe(503);
  });
  it.each(changes)(
    'validates receipts against the submitted command: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) =>
        json(
          response,
          { ...(result as object), revision: 0 },
          method === 'POST' ? 201 : 200
        );
      expect((await call(path, body, method)).status).toBe(503);
      expect(observed).toHaveLength(1);
    }
  );
  it('rejects receipts with the wrong resource, revision or extra fields', async () => {
    for (const [path, body, values] of [
      [
        `${cbase}/${id}`,
        { expectedRevision: 4 },
        [
          { ...commentReceipt, id: other },
          { ...commentReceipt, revision: 6 },
          { ...commentReceipt, projection: 'ready' },
          { ...commentReceipt, ownerId: 'secret' },
        ],
      ],
      [
        `${rbase}/${id}`,
        { expectedRevision: 4 },
        [
          { ...reviewReceipt, id: other },
          { ...reviewReceipt, revision: 6 },
          { ...reviewReceipt, ownerId: 'secret' },
        ],
      ],
    ] as const)
      for (const result of values) {
        handler = (_request, response) => json(response, result);
        expect((await call(path, body, 'DELETE')).status).toBe(503);
      }
  });
  it('accepts a new review slot at revision zero', async () => {
    handler = (_request, response) => json(response, { id, revision: 1 });
    expect(
      await (
        await call(
          `${rbase}/mine`,
          { content: reviewContent, expectedRevision: 0 },
          'PUT'
        )
      ).json()
    ).toEqual({ id, revision: 1 });
  });
  it.each(changes)(
    'replays only the exact caller command without preflights or retries: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) =>
        json(response, result, method === 'POST' ? 201 : 200);
      for (let i = 0; i < 2; i++)
        expect(await (await call(path, body, method)).json()).toEqual(result);
      expect(observed.map((request) => request.method)).toEqual([
        method,
        method,
      ]);
      expect(
        observed.map((request) => request.headers['idempotency-key'])
      ).toEqual([stableKey, stableKey]);
      expect(observed[0].body).toBe(observed[1].body);
    }
  );
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502, 503, 504])(
    'preserves denial/conflict and sanitizes downstream failure %s',
    async (status) => {
      handler = (_request, response) =>
        json(response, { secret: 'database credentials' }, status);
      for (const path of [`${cbase}/${id}`, `${rbase}/${id}`]) {
        const response = await call(path, { expectedRevision: 4 }, 'DELETE');
        expect(response.status).toBe(status < 500 ? status : 503);
        expect(response.headers.get('cache-control')).toContain('no-store');
        if (status >= 500 || status === 429)
          expect(response.headers.get('retry-after')).toBe('2');
        expect(JSON.stringify(await response.json())).not.toContain(
          'credentials'
        );
      }
      expect(observed).toHaveLength(2);
    }
  );
  it.each([
    undefined,
    '',
    'not a URL',
    'file:///etc/passwd',
    'http://localhost/path',
    'http://name:pass@localhost',
    'http://localhost/?query',
    'http://localhost/#hash',
  ])('fails closed on unsafe origin %s', async (url) => {
    config.DISCUSSION_URL = url;
    for (const path of [cbase, rbase])
      expect((await call(path)).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it.each([cbase, rbase])(
    'bounds responses, refuses redirects/content-type errors and does not retry lost responses: %s',
    async (path) => {
      handler = (_request, response) => {
        response.writeHead(307, { location: upstreamOrigin + '/secret' });
        response.end();
      };
      expect((await call(path)).status).toBe(503);
      handler = (_request, response) => {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('{}');
      };
      expect((await call(path)).status).toBe(503);
      handler = (_request, response) =>
        json(response, { large: 'x'.repeat(513 * 1024) });
      expect((await call(path)).status).toBe(503);
      handler = (request) => request.socket.destroy();
      expect(
        (await call(path + '/' + id, { expectedRevision: 4 }, 'DELETE')).status
      ).toBe(503);
      expect(observed).toHaveLength(4);
    }
  );
  it.each([201, 204, 206])(
    'refuses unexpected read status %s',
    async (status) => {
      handler = (_request, response) => json(response, thread, status);
      for (const path of [cbase, rbase])
        expect((await call(path)).status).toBe(503);
    }
  );
  it('shares full-thread concurrency bounds with application discussions', async () => {
    const pending: ServerResponse[] = [];
    handler = (_request, response) => {
      pending.push(response);
    };
    const first = call(`${cbase}/${id}`),
      second = call(`/api/application-discussions/${target}/${id}`);
    try {
      for (let attempt = 0; pending.length < 2 && attempt < 100; attempt++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      expect(pending).toHaveLength(2);
      expect((await call(`${cbase}/${other}`)).status).toBe(503);
      expect(observed).toHaveLength(2);
    } finally {
      for (const response of pending) json(response, {}, 503);
      await Promise.all([first, second]);
    }
    handler = (_request, response) => json(response, thread);
    expect((await call(`${cbase}/${id}`)).status).toBe(200);
  });
  it('bounds a stalled review command and preserves its exact caller retry', async () => {
    handler = () => undefined;
    const body = { expectedRevision: 4 },
      started = Date.now();
    expect((await call(`${rbase}/${id}`, body, 'DELETE')).status).toBe(503);
    expect(Date.now() - started).toBeLessThan(18_000);
    expect(observed).toHaveLength(1);
    handler = (_request, response) => json(response, reviewReceipt);
    expect(await (await call(`${rbase}/${id}`, body, 'DELETE')).json()).toEqual(
      reviewReceipt
    );
    expect(
      observed.map((request) => request.headers['idempotency-key'])
    ).toEqual([stableKey, stableKey]);
    expect(observed[0].body).toBe(observed[1].body);
  }, 20_000);
  it.each([
    `${cbase}/${id}/vote`,
    `${cbase}/${id}/pin`,
    `${rbase}/${id}/raw`,
    `${rbase}/${id}/reports/export`,
    '/api/article-comments',
    '/api/application-reviews',
  ])('does not create open proxy routes: %s', async (path) => {
    expect((await call(path)).status).toBe(404);
    expect(observed).toHaveLength(0);
  });
});
