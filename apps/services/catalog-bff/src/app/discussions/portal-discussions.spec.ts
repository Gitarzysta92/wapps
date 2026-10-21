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
const application = '10000000-0000-4000-8000-000000000003';
const content = {
  displayName: 'Public Alice',
  text: 'A public reply',
  mentions: [other],
};
const topic = { ...content, title: 'Discussion title', tags: ['tools'] };
const post = {
  id,
  parentId: null,
  depth: 0,
  content,
  createdAt: 1000,
  updatedAt: null,
  editable: false,
  removable: false,
  votes: { upvotes: 0, downvotes: 0, mine: 0 },
};
const thread = {
  id,
  revision: 4,
  replyCount: 0,
  comments: [post],
  title: topic.title,
  tags: topic.tags,
  pinned: false,
  canPin: false,
};
const page = { items: [thread], next: null };
const mine = {
  items: [
    {
      id,
      applicationId: application,
      title: topic.title,
      createdAt: 1000,
      replyCount: 0,
      participation: 'author',
    },
  ],
  next: null,
};
const selection = {
  items: [
    {
      id,
      applicationId: application,
      title: topic.title,
      revision: 4,
      replyCount: 0,
    },
  ],
};
const receipt = { id, discussionId: id, revision: 5, projection: 'pending' };
const base = '/api/application-discussions/' + application;
const trusted = {
  'x-ingress-auth': 'discussion-test',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"tenantId":"tenant-a","roles":["admin"],"ignored":"secret"}',
};
const anonymous = {
  'x-ingress-auth': trusted['x-ingress-auth'],
  'x-anonymous': 'true',
};
type Endpoint = [string, string, unknown?, unknown?];
const reads: Endpoint[] = [
  ['GET', base, undefined, page],
  ['GET', `${base}/${id}`, undefined, thread],
  ['GET', '/api/me/discussions', undefined, mine],
  ['GET', '/api/discussion-selection?ids=' + id, undefined, selection],
];
const changes: Endpoint[] = [
  ['POST', base, topic, { ...receipt, revision: 1 }],
  ['POST', `${base}/${id}/replies`, content, { ...receipt, id: other }],
  ['PUT', `${base}/${id}`, { content: topic, expectedRevision: 4 }, receipt],
  [
    'PUT',
    `${base}/${other}`,
    { content, expectedRevision: 4 },
    { ...receipt, id: other },
  ],
  ['DELETE', `${base}/${id}`, { expectedRevision: 4 }, receipt],
  [
    'PUT',
    `${base}/${other}/vote`,
    { value: -1, expectedRevision: 4 },
    { ...receipt, id: other },
  ],
  ['PUT', `${base}/${id}/pin`, { pinned: true, expectedRevision: 4 }, receipt],
];
const endpoints = [...reads, ...changes];
// Supply owner-shaped fixtures while retaining the existing public-contract regression cases.
function ownerFixture(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const row = input as Record<string, unknown>;
  if (Array.isArray(row.items))
    return { ...row, items: row.items.map(ownerFixture) };
  if ('comments' in row) {
    const { title, tags, ...rest } = row;
    return {
      ...rest,
      bindingKey: 'application:' + application,
      comments: Array.isArray(row.comments)
        ? row.comments.map((value, index) =>
            index === 0 && value && typeof value === 'object'
              ? {
                  ...value,
                  content: {
                    ...(value as { content: object }).content,
                    title,
                    tags,
                  },
                }
              : value
          )
        : row.comments,
    };
  }
  if ('applicationId' in row) {
    const { applicationId, title, createdAt, participation, ...rest } = row;
    const value = {
      ...thread,
      ...rest,
      title,
      bindingKey: 'application:' + applicationId,
      comments: [
        {
          ...post,
          id: row.id,
          createdAt: createdAt ?? 1000,
          content: { ...content, title, tags: [] },
        },
      ],
    };
    delete (value as Record<string, unknown>).title;
    delete (value as Record<string, unknown>).tags;
    return participation === undefined
      ? value
      : { thread: value, at: createdAt, participation };
  }
  return input;
}
function ownerPath(path: string, method = 'GET') {
  const url = new URL(path, 'http://fixture.test');
  if (url.pathname === '/api/me/discussions')
    return (
      '/api/discussions/participation?' +
      new URLSearchParams({
        bindingPrefix: 'application:',
        includeVotes: 'true',
        ...(url.searchParams.has('cursor')
          ? { cursor: url.searchParams.get('cursor') as string }
          : {}),
      })
    );
  if (url.pathname === '/api/discussion-selection')
    return (
      '/api/discussions/selection?' +
      new URLSearchParams({
        bindingPrefix: 'application:',
        includeVotes: 'true',
        ids: url.searchParams.get('ids') as string,
      })
    );
  const suffix = url.pathname
    .slice(base.length)
    .replace('/replies', '/comments');
  const query = new URLSearchParams({
    bindingKey: 'application:' + application,
  });
  if (method === 'GET') {
    if (!suffix) query.set('order', 'pinned');
    query.set('includeVotes', 'true');
    if (url.searchParams.has('cursor'))
      query.set('cursor', url.searchParams.get('cursor') as string);
  }
  return '/api/discussions' + suffix + '?' + query;
}
const json = (response: ServerResponse, body: unknown, status = 200) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(ownerFixture(body)));
};

describe('application discussions through production BFF routes', () => {
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
    handler = (_request, response) => json(response, thread);
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

  it.each(endpoints)(
    'requires trusted provenance: %s %s',
    async (method, path, body) => {
      expect(
        (await call(path, body, method, { 'x-user-id': 'Alice' })).status
      ).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([reads[2], ...changes])(
    'requires a member: %s %s',
    async (method, path, body) => {
      expect((await call(path, body, method, anonymous)).status).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each(endpoints)(
    'rejects extra selectors: %s %s',
    async (method, path, body) => {
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
    }
  );
  it.each(endpoints)(
    'preserves the full contract: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) =>
        json(response, result, method === 'POST' ? 201 : 200);
      const response = await call(path, body, method);
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(ownerPath(path, method));
      expect(observed[0].method).toBe(method);
      if (body !== undefined) {
        expect(JSON.parse(observed[0].body)).toEqual(
          method === 'POST'
            ? path === base
              ? { content: body, subjectId: application }
              : { content: body }
            : body
        );
        expect(observed[0].headers['idempotency-key']).toBe('stable-key');
      }
    }
  );
  it.each([reads[0], reads[1], reads[3]])(
    'serves verified anonymous reads: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) => json(response, result);
      expect(await (await call(path, body, method, anonymous)).json()).toEqual(
        result
      );
      expect(observed[0].headers['x-anonymous']).toBe('true');
      expect(observed[0].headers['x-user-id']).toBeUndefined();
    }
  );
  it('forwards only verified identity and sanitized tenant/roles', async () => {
    await call(`${base}/${id}`, undefined, 'GET', {
      ...trusted,
      authorization: 'Bearer private',
      cookie: 'private=1',
      'x-user-email': 'private@example.test',
      'x-notification-worker': 'private',
    });
    expect(observed[0].headers['x-user-claims']).toBe(
      '{"tenantId":"tenant-a","roles":["admin"]}'
    );
    expect(observed[0].headers['x-user-id']).toBe('Alice');
    for (const key of [
      'authorization',
      'cookie',
      'x-user-email',
      'x-notification-worker',
    ])
      expect(observed[0].headers[key]).toBeUndefined();
  });
  it.each(['null', '[]', '{', '{"roles":"admin"}', '{"tenantId":""}'])(
    'rejects malformed identity claims %s',
    async (claims) => {
      expect(
        (
          await call(base, undefined, 'GET', {
            ...trusted,
            'x-user-claims': claims,
          })
        ).status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects conflicting anonymous identity', async () => {
    expect(
      (
        await call(base, undefined, 'GET', {
          ...anonymous,
          'x-user-id': 'Alice',
        })
      ).status
    ).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each(['', 'a/b', 'a'.repeat(129)])(
    'rejects invalid command key %s',
    async (key) => {
      const response = await fetch(origin + base, {
        method: 'POST',
        body: JSON.stringify(topic),
        headers: {
          ...trusted,
          'content-type': 'application/json',
          'idempotency-key': key,
        },
      });
      expect(response.status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('rejects duplicate keys and GET bodies before forwarding', async () => {
    for (const mutation of [true, false]) {
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const payload = mutation ? JSON.stringify(topic) : '{}';
          const request = httpRequest(
            origin + base,
            {
              method: mutation ? 'POST' : 'GET',
              headers: {
                ...trusted,
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
                ...(mutation ? { 'idempotency-key': ['one', 'two'] } : {}),
              },
            },
            (response) => {
              response.resume();
              response.on('end', () => resolve(response.statusCode));
            }
          );
          request.on('error', reject);
          request.end(payload);
        }
      );
      expect(status).toBe(400);
    }
    expect(observed).toHaveLength(0);
  });
  it.each([
    'bad',
    id.toUpperCase().replace('1000', 'FFFF'),
    '../secret',
    id + '%2fsecret',
  ])('rejects noncanonical path IDs %s', async (value) => {
    expect([400, 404]).toContain(
      (await call(`/api/application-discussions/${value}/${id}`)).status
    );
    expect(observed).toHaveLength(0);
  });
  it.each([
    '?cursor=',
    '?cursor=bad',
    `?cursor=0.1000.${id}&cursor=0.1000.${id}`,
    '?cursor[x]=1',
  ])('rejects invalid cursors %s', async (query) => {
    for (const path of [base, '/api/me/discussions'])
      expect((await call(path + query)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('preserves both cursor formats and empty participation pages with continuations', async () => {
    handler = (_request, response) => json(response, { items: [], next: null });
    expect((await call(base + `?cursor=1.1000.${id}`)).status).toBe(200);
    expect(observed[0].url).toBe(ownerPath(base + `?cursor=1.1000.${id}`));
    handler = (_request, response) =>
      json(response, { items: [], next: `1000.${other}` });
    expect(
      await (await call(`/api/me/discussions?cursor=2000.${id}`)).json()
    ).toEqual({ items: [], next: `1000.${other}` });
  });
  it.each(['', 'bad', `${id},${id}`, Array(51).fill(id).join(',')])(
    'rejects invalid selection %s',
    async (ids) => {
      expect((await call('/api/discussion-selection?ids=' + ids)).status).toBe(
        400
      );
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    ['POST', base, { ...topic, ownerId: 'other' }],
    ['POST', base, { ...topic, title: '' }],
    ['POST', base, { ...topic, tags: ['Tools', 'tools'] }],
    ['POST', base, { ...topic, mentions: [id, id] }],
    ['POST', base + '/' + id + '/replies', topic],
    [
      'POST',
      base + '/' + id + '/replies',
      { ...content, text: 'x'.repeat(5001) },
    ],
    ['PUT', base + '/' + id, { content: topic, expectedRevision: '4' }],
    [
      'PUT',
      base + '/' + id,
      { content: topic, expectedRevision: 4, visibility: 'private' },
    ],
    ['DELETE', base + '/' + id, { expectedRevision: 0 }],
    ['PUT', base + '/' + id + '/pin', { expectedRevision: 4, pinned: 'true' }],
    ['PUT', base + '/' + id + '/vote', { expectedRevision: 4, value: 2 }],
    [
      'PUT',
      base + '/' + id + '/vote',
      { expectedRevision: Number.MAX_SAFE_INTEGER + 1, value: 1 },
    ],
  ] as const)('rejects invalid body: %s %s %#', async (method, path, body) => {
    expect((await call(path, body, method)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('preserves multilingual bodies, normalized tags and mention IDs', async () => {
    handler = (_request, response) =>
      json(response, { ...receipt, revision: 1 }, 201);
    const body = {
      ...topic,
      title: '  Topic  ',
      tags: ['TOOLS'],
      text: '\u754c'.repeat(5000),
    };
    expect((await call(base, body)).status).toBe(201);
    expect(JSON.parse(observed[0].body)).toEqual({
      content: { ...body, title: 'Topic', tags: ['tools'] },
      subjectId: application,
    });
  });
  it('keeps deleted ancestors, nested replies, votes and ownership flags', async () => {
    const child = '10000000-0000-4000-8000-000000000004';
    const value = {
      ...thread,
      replyCount: 2,
      canPin: true,
      pinned: true,
      comments: [
        post,
        {
          ...post,
          id: other,
          parentId: id,
          depth: 1,
          content: null,
          createdAt: null,
          votes: null,
        },
        {
          ...post,
          id: child,
          parentId: other,
          depth: 2,
          editable: true,
          removable: true,
          votes: { upvotes: 2, downvotes: 1, mine: -1 },
        },
      ],
    };
    handler = (_request, response) => json(response, value);
    expect(await (await call(`${base}/${id}`)).json()).toEqual(value);
  });
  it.each([
    null,
    {},
    { ...thread, id: other },
    { ...thread, revision: 0 },
    { ...thread, ownerId: 'secret' },
    { ...thread, pinned: 'true' },
    { ...thread, comments: [] },
    { ...thread, comments: [post, post] },
    { ...thread, replyCount: 1 },
    { ...thread, replyCount: 2000 },
    { ...thread, comments: [{ ...post, content: null }] },
    { ...thread, comments: [{ ...post, votes: undefined }] },
    {
      ...thread,
      comments: [{ ...post, votes: { upvotes: 0, downvotes: 0, mine: 1 } }],
    },
    { ...thread, comments: [{ ...post, createdAt: null }] },
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
          votes: null,
          editable: true,
        },
      ],
    },
  ])('fails closed on malformed thread %#', async (value) => {
    handler = (_request, response) => json(response, value);
    const response = await call(`${base}/${id}`);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(JSON.stringify(await response.json())).not.toContain('secret');
  });
  it.each([
    { items: [thread, thread], next: null },
    { items: [thread], next: `0.1000.${id}` },
    { items: Array(11).fill(thread), next: null },
    { items: [], next: 'bad' },
    { items: [], next: null, ownerId: 'secret' },
  ])('fails closed on malformed page %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(base)).status).toBe(503);
  });
  it('validates a full page continuation against its final root', async () => {
    const items = Array.from({ length: 10 }, (_, i) => {
      const rootId =
        '10000000-0000-4000-8000-' + String(i + 1).padStart(12, '0');
      return { ...thread, id: rootId, comments: [{ ...post, id: rootId }] };
    });
    const next = `0.1000.${items[9].id}`;
    handler = (_request, response) => json(response, { items, next });
    expect((await call(base)).status).toBe(200);
    handler = (_request, response) =>
      json(response, { items, next: `1.1000.${items[9].id}` });
    expect((await call(base)).status).toBe(503);
  });
  it.each([
    null,
    {},
    { ...receipt, revision: 99 },
    { ...receipt, id: other },
    { ...receipt, projection: 'ready' },
    { ...receipt, privateId: 'secret' },
  ])('rejects malformed command receipt %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect(
      (
        await call(
          `${base}/${id}`,
          { content: topic, expectedRevision: 4 },
          'PUT'
        )
      ).status
    ).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it('rejects impossible creation, reply and pin receipts', async () => {
    for (const [path, body, method, result] of [
      [base, topic, 'POST', receipt],
      [`${base}/${id}/replies`, content, 'POST', receipt],
      [
        `${base}/${id}/pin`,
        { pinned: true, expectedRevision: 4 },
        'PUT',
        { ...receipt, discussionId: other },
      ],
    ] as const) {
      handler = (_request, response) =>
        json(response, result, method === 'POST' ? 201 : 200);
      expect((await call(path, body, method)).status).toBe(503);
    }
  });
  it('preserves historical receipts without any projection preflight or retry', async () => {
    handler = (_request, response) => json(response, receipt);
    for (let i = 0; i < 2; i++)
      expect(
        await (
          await call(`${base}/${id}`, { expectedRevision: 4 }, 'DELETE')
        ).json()
      ).toEqual(receipt);
    expect(observed.map((request) => request.method)).toEqual([
      'DELETE',
      'DELETE',
    ]);
    expect(
      observed.map((request) => request.headers['idempotency-key'])
    ).toEqual(['stable-key', 'stable-key']);
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 502, 503, 504])(
    'preserves denial/conflict and sanitizes failure %s',
    async (status) => {
      handler = (_request, response) =>
        json(response, { secret: 'database credentials' }, status);
      const response = await call(
        `${base}/${id}`,
        { content: topic, expectedRevision: 4 },
        'PUT'
      );
      expect(response.status).toBe(status < 500 ? status : 503);
      expect(JSON.stringify(await response.json())).not.toContain(
        'credentials'
      );
      expect(observed).toHaveLength(1);
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
  ])('fails closed on unconfigured/unsafe origin %s', async (url) => {
    config.DISCUSSION_URL = url;
    expect((await call(`${base}/${id}`)).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it.each([201, 204, 206])(
    'rejects unexpected success status %s',
    async (status) => {
      handler = (_request, response) => json(response, thread, status);
      expect((await call(`${base}/${id}`)).status).toBe(503);
    }
  );
  it('rejects incorrect content types and redirects without following them', async () => {
    handler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(JSON.stringify(thread));
    };
    expect((await call(`${base}/${id}`)).status).toBe(503);
    handler = (_request, response) => {
      response.writeHead(307, { location: upstreamOrigin + '/secret' });
      response.end();
    };
    expect((await call(`${base}/${id}`)).status).toBe(503);
    expect(observed).toHaveLength(2);
  });
  it('reports lost command responses as uncertain without retrying', async () => {
    handler = (request) => request.socket.destroy();
    expect((await call(base, topic)).status).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it('bounds list responses while allowing large valid full threads', async () => {
    handler = (_request, response) =>
      json(response, { unexpected: 'x'.repeat(512 * 1024) });
    expect((await call(base)).status).toBe(503);
    const comments = Array.from({ length: 2000 }, (_, i) => ({
      ...post,
      id: '10000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
      parentId: i === 0 ? null : id,
      depth: i === 0 ? 0 : 1,
      content: { displayName: 'Public Alice', text: '\u754c'.repeat(5000) },
    }));
    handler = (_request, response) =>
      json(response, { ...thread, replyCount: 1999, comments });
    const response = await call(`${base}/${id}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...thread,
      replyCount: 1999,
      comments,
    });
  });
  it('bounds concurrent full threads and releases slots after completion', async () => {
    const held: ServerResponse[] = [];
    let ready: () => void = () => undefined;
    const both = new Promise<void>((resolve) => {
      ready = resolve;
    });
    handler = (_request, response) => {
      held.push(response);
      if (held.length === 2) ready();
    };
    const first = call(`${base}/${id}`),
      second = call(`${base}/${id}`);
    try {
      await both;
      expect((await call(`${base}/${id}`)).status).toBe(503);
      expect(observed).toHaveLength(2);
    } finally {
      for (const response of held) json(response, thread);
      expect((await first).status).toBe(200);
      expect((await second).status).toBe(200);
    }
    handler = (_request, response) => json(response, thread);
    expect((await call(`${base}/${id}`)).status).toBe(200);
  });
  it('accepts fifty bounded owner summaries containing full consumer payloads', async () => {
    const ids = Array.from(
      { length: 50 },
      (_, index) =>
        '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0')
    );
    const items = ids.map((id) => ({
      id,
      bindingKey: 'application:' + application,
      revision: 1,
      replyCount: 0,
      pinned: false,
      canPin: false,
      comments: [
        { ...post, id, content: { ...topic, text: '\u754c'.repeat(5000) } },
      ],
    }));
    const body = JSON.stringify({ items });
    expect(Buffer.byteLength(body)).toBeGreaterThan(512 * 1024);
    handler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(body);
    };
    const response = await call(
      '/api/discussion-selection?ids=' + ids.join(',')
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: ids.map((id) => ({
        id,
        applicationId: application,
        revision: 1,
        title: topic.title,
        replyCount: 0,
      })),
    });
  });
  it('terminates stalled dependencies and releases the thread slot', async () => {
    handler = () => undefined;
    const started = Date.now();
    expect((await call(`${base}/${id}`)).status).toBe(503);
    expect(Date.now() - started).toBeLessThan(18_000);
    expect(observed).toHaveLength(1);
    handler = (_request, response) => json(response, thread);
    expect((await call(`${base}/${id}`)).status).toBe(200);
  }, 20_000);
  it.each([
    '/api/application-discussions',
    `${base}/${id}/unknown`,
    '/api/me/discussions/unknown',
    '/api/discussion-selection/unknown',
    '/api/internal/discussions',
  ])('does not proxy unknown routes %s', async (path) => {
    expect((await call(path)).status).toBe(404);
    expect(observed).toHaveLength(0);
  });
});
