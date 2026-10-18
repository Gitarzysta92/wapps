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
import { configureGenericDiscussionBody } from './portal-generic-discussions.body';

const id = '10000000-0000-4000-8000-000000000001';
const child = '10000000-0000-4000-8000-000000000002';
const grandchild = '10000000-0000-4000-8000-000000000003';
const base = '/api/discussions';
const aggregate = {
  _id: id,
  schemaVersion: 4,
  tenantId: 'default',
  generation: `${id}:4:${'a'.repeat(64)}`,
  fingerprint: 'a'.repeat(64),
  revision: 4,
  subjectId: null,
  subjectReferenceKey: null,
  visibility: 'public',
  state: 'published',
  deletedAt: null,
  createdAt: 1000,
  lastActivityAt: 1001,
  descendantsCount: 0,
  nodeCount: 1,
};
const node = {
  _id: id,
  id,
  referenceKey: id,
  kind: 'discussion',
  parentId: null,
  ownerIdentityId: 'Alice',
  state: 'published',
  visibility: 'public',
  createdAt: 1000,
  updatedAt: null,
  deletedAt: null,
  likeCount: 0,
  payload: {
    content: { blocks: [{ type: 'paragraph', text: 'Original body' }] },
  },
  schemaVersion: 4,
  discussionId: id,
  generation: aggregate.generation,
  revision: 4,
  depth: 0,
};
const thread = { aggregate, nodes: [node] };
const receipt = { id, discussionId: id, revision: 5, projection: 'pending' };
const trusted = {
  'x-ingress-auth': 'generic-discussion-test',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims': '{"tenantId":"default","roles":[],"ignored":"secret"}',
};
const anonymous = {
  'x-ingress-auth': trusted['x-ingress-auth'],
  'x-anonymous': 'true',
};
type Endpoint = [string, string, unknown, unknown];
const reads: Endpoint[] = [
  ['GET', base, undefined, [aggregate]],
  ['GET', `${base}/${id}`, undefined, thread],
];
const changes: Endpoint[] = [
  [
    'POST',
    base,
    {
      content: node.payload.content,
      subjectId: child,
      state: 'draft',
      visibility: 'private',
    },
    { ...receipt, revision: 1 },
  ],
  [
    'POST',
    `${base}/${id}/comments`,
    { content: false },
    { ...receipt, id: child },
  ],
  [
    'PUT',
    `${base}/${id}`,
    { content: ['edited', 1], expectedRevision: 4, visibility: 'unlisted' },
    receipt,
  ],
  ['DELETE', `${base}/${id}`, { expectedRevision: 4 }, receipt],
  [
    'POST',
    `${base}/comments/${child}/like`,
    undefined,
    { ...receipt, id: child },
  ],
  [
    'DELETE',
    `${base}/comments/${child}/like`,
    undefined,
    { ...receipt, id: child },
  ],
];
const endpoints = [...reads, ...changes];
const json = (response: ServerResponse, body: unknown, status = 200) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

describe('generic discussions through production BFF routes', () => {
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
    configureGenericDiscussionBody(app);
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
    handler = (_request, response) => json(response, thread);
  });
  const call = (
    path: string,
    body?: unknown,
    method = 'GET',
    headers: Record<string, string> = trusted
  ) =>
    fetch(origin + path, {
      method,
      headers: {
        ...headers,
        'idempotency-key': 'stable-key',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  it.each(endpoints)(
    'requires trusted ingress: %s %s',
    async (method, path, body) => {
      expect(
        (await call(path, body, method, { 'x-user-id': 'Alice' })).status
      ).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each(changes)(
    'requires member identity: %s %s',
    async (method, path, body) => {
      expect((await call(path, body, method, anonymous)).status).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each(endpoints)(
    'rejects caller scope selectors: %s %s',
    async (method, path, body) => {
      expect(
        (await call(path + '?bindingKey=other', body, method)).status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each(endpoints)(
    'preserves contracts, keys and HTTP methods: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) =>
        json(response, result, method === 'POST' ? 201 : 200);
      const response = await call(path, body, method);
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(path);
      expect(observed[0].method).toBe(method);
      if (method !== 'GET')
        expect(observed[0].headers['idempotency-key']).toBe('stable-key');
      expect(
        observed[0].body ? JSON.parse(observed[0].body) : undefined
      ).toEqual(body);
    }
  );
  it.each(reads)(
    'supports anonymous read: %s %s',
    async (method, path, body, result) => {
      handler = (_request, response) => json(response, result);
      expect(await (await call(path, body, method, anonymous)).json()).toEqual(
        result
      );
      expect(observed[0].headers['x-user-id']).toBeUndefined();
    }
  );
  it('forwards only allowlisted verified identity context', async () => {
    await call(`${base}/${id}`, undefined, 'GET', {
      ...trusted,
      authorization: 'Bearer secret',
      cookie: 'secret',
      'x-account-erasure-writer': 'secret',
      'x-user-email': 'private@example.test',
      'x-tenant-id': 'foreign',
    });
    expect(observed[0].headers['x-user-claims']).toBe(
      '{"tenantId":"default","roles":[]}'
    );
    for (const name of [
      'authorization',
      'cookie',
      'x-account-erasure-writer',
      'x-user-email',
      'x-tenant-id',
    ])
      expect(observed[0].headers[name]).toBeUndefined();
  });
  it.each(changes)(
    'requires a valid key even for bodyless commands: %s %s',
    async (method, path, body) => {
      const response = await fetch(origin + path, {
        method,
        headers: { ...trusted, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      expect(response.status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    { content: null },
    { content: ' ' },
    { content: 'ok', bindingKey: 'foreign' },
    { content: 'ok', target: { kind: 'application', id } },
    { content: 'ok', ownerIdentityId: 'other' },
    { content: 'ok', subjectId: '../internal' },
    { content: 'ok', visibility: 'unknown' },
    { content: 'ok', state: 'deleted' },
    { content: 'a'.repeat(256 * 1024) },
  ])('rejects invalid create input %#', async (body) => {
    expect((await call(base, body, 'POST')).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    ['PUT', `${base}/${id}`, { content: 'body', expectedRevision: 0 }],
    ['PUT', `${base}/${id}`, { content: 'body', expectedRevision: '4' }],
    ['DELETE', `${base}/${id}`, { expectedRevision: 4, content: 'extra' }],
    ['POST', `${base}/${id}/comments`, { content: 'body', state: 'private' }],
    ['POST', `${base}/comments/${child}/like`, { liked: true }],
    ['DELETE', `${base}/comments/${child}/like`, { owner: 'other' }],
  ] as const)('rejects invalid change: %s %s', async (method, path, body) => {
    expect((await call(path, body, method)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('keeps arbitrary consumer JSON including Unicode, keys and ordering', async () => {
    handler = (_request, response) =>
      json(response, { ...receipt, revision: 1 }, 201);
    const body = {
      content: {
        'new-consumer:v99': ['\u754c'.repeat(50000), false, 42, null],
      },
    };
    expect((await call(base, body, 'POST')).status).toBe(201);
    expect(JSON.parse(observed[0].body)).toEqual(body);
  });
  it('retains the default JSON parser for other BFF route families', async () => {
    const body = {
      title: 'Bound topic',
      text: 'Body',
      displayName: 'Alice',
      tags: [],
    };
    handler = (_request, response) =>
      json(response, { ...receipt, revision: 1 }, 201);
    const response = await call(
      '/api/application-discussions/' + child,
      body,
      'POST'
    );
    expect(response.status).toBe(201);
    expect(JSON.parse(observed[0].body)).toEqual({
      content: body,
      subjectId: child,
    });
  });
  it('preserves erased authors and structural placeholders for removed ancestors', async () => {
    const value = {
      aggregate: { ...aggregate, nodeCount: 3, descendantsCount: 1 },
      nodes: [
        { ...node, ownerIdentityId: null, payload: { content: null } },
        {
          id: child,
          parentId: id,
          depth: 1,
          kind: 'comment',
          payload: null,
          redacted: true,
        },
        {
          ...node,
          _id: grandchild,
          id: grandchild,
          kind: 'comment',
          parentId: child,
          depth: 2,
        },
      ],
    };
    handler = (_request, response) => json(response, value);
    expect(await (await call(`${base}/${id}`)).json()).toEqual(value);
  });
  it.each([
    { ...thread, aggregate: { ...aggregate, bindingKey: 'foreign' } },
    { ...thread, aggregate: { ...aggregate, _id: child } },
    { ...thread, aggregate: { ...aggregate, deletedAt: 10 } },
    { ...thread, aggregate: { ...aggregate, nodeCount: 2 } },
    { ...thread, aggregate: { ...aggregate, nodeCount: 2001 } },
    { ...thread, nodes: [{ ...node, revision: 3 }] },
    { ...thread, nodes: [{ ...node, generation: 'other' }] },
    { ...thread, nodes: [{ ...node, payload: { content: null } }] },
    { ...thread, nodes: [{ ...node, ownerToken: 'secret' }] },
    {
      aggregate: { ...aggregate, nodeCount: 2, descendantsCount: 1 },
      nodes: [
        node,
        { ...node, id: child, kind: 'comment', parentId: child, depth: 1 },
      ],
    },
    {
      aggregate: { ...aggregate, nodeCount: 2, descendantsCount: 0 },
      nodes: [
        node,
        {
          id: child,
          parentId: id,
          depth: 1,
          kind: 'comment',
          payload: { content: 'secret' },
          redacted: true,
        },
      ],
    },
  ])('fails closed for inconsistent upstream generations %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(`${base}/${id}`)).status).toBe(503);
  });
  it.each([
    null,
    {},
    [aggregate, aggregate],
    [{ ...aggregate, bindingKey: 'bound' }],
    Array(51).fill(aggregate),
  ])('rejects invalid upstream listing %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(base)).status).toBe(503);
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 500, 503])(
    'preserves safe error semantics without exposing upstream text: %s',
    async (status) => {
      handler = (_request, response) =>
        json(response, { message: 'private database secret' }, status);
      const response = await call(`${base}/${id}`);
      expect(response.status).toBe(status >= 500 ? 503 : status);
      expect(await response.text()).not.toContain('private database');
      expect(response.headers.get('cache-control')).toContain('no-store');
      if (status >= 500 || status === 429)
        expect(response.headers.get('retry-after')).toBe('2');
    }
  );
  it('does not retry a command after a lost response', async () => {
    handler = (request) => request.socket.destroy();
    expect((await call(base, { content: 'body' }, 'POST')).status).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it('does not follow upstream redirects', async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: upstreamOrigin + '/internal' });
      response.end();
    };
    expect((await call(`${base}/${id}`)).status).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it.each([
    '',
    'https://user:password@example.test',
    'http://example.test/internal',
    'file:///private',
  ])('rejects unsafe or missing service configuration %#', async (url) => {
    config.DISCUSSION_URL = url;
    expect((await call(base)).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it.each([
    ['POST', { ...receipt, revision: 2 }],
    ['PUT', { ...receipt, revision: 6 }],
    ['DELETE', { ...receipt, id: child }],
  ] as const)('rejects mismatched receipts %s', async (method, result) => {
    handler = (_request, response) =>
      json(response, result, method === 'POST' ? 201 : 200);
    expect(
      (
        await call(
          base + (method === 'POST' ? '' : '/' + id),
          {
            ...(method === 'DELETE' ? {} : { content: 'body' }),
            ...(method === 'POST' ? {} : { expectedRevision: 4 }),
          },
          method
        )
      ).status
    ).toBe(503);
  });
  it('rejects malformed and oversized HTTP bodies with no-store errors', async () => {
    for (const [body, status] of [
      ['{', 400],
      [JSON.stringify({ content: 'x'.repeat(301 * 1024) }), 413],
    ] as const) {
      const response = await fetch(origin + base, {
        method: 'POST',
        headers: {
          ...trusted,
          'content-type': 'application/json',
          'idempotency-key': 'key',
        },
        body,
      });
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
    expect(observed).toHaveLength(0);
  });
  it('rejects duplicate command keys and GET bodies before forwarding', async () => {
    for (const method of ['POST', 'GET']) {
      const body = JSON.stringify({ content: 'test' });
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const request = httpRequest(
            origin + base,
            {
              method,
              headers: {
                ...trusted,
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(body),
                'idempotency-key': ['one', 'two'],
              },
            },
            (response) => {
              response.resume();
              response.on('end', () => resolve(response.statusCode));
            }
          );
          request.on('error', reject);
          request.end(body);
        }
      );
      expect(status).toBe(400);
    }
    expect(observed).toHaveLength(0);
  });
});
