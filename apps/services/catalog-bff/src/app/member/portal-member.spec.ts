import { defaultAccountPreferences } from '@domains/customer/preferences';
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
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { parseFavoriteContent } from '@domains/customer/favorites';

const id = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const trusted = {
  'x-ingress-auth': 'test-member-ingress',
  'x-user-id': 'Alice',
  'x-user-claims': '{"roles":["member"],"discard":"private"}',
};
const target = { kind: 'applications', id };
const command = { expectedRevision: 3, target, saved: true };
const favorite = { ...target, addedAt: 10 };
const receipt = { identityId: 'Alice', revision: 4 };
const appData = {
  id,
  revision: 1,
  name: 'Current application',
  slug: 'current-app',
  description: null,
  website: null,
  logoUrl: 'https://example.test/logo.png',
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-14T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
  classification: 'general',
};
const routes = [
  '/api/me/notifications',
  '/api/me/notifications/mentions',
  '/api/me/notifications/favorites',
];
function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}
type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown
) => void;

describe('favorites and all notification inboxes through the production BFF', () => {
  let app: INestApplication,
    upstream: Server,
    origin: string,
    upstreamOrigin: string;
  let handler: Handler;
  let saved: {
    identityId: string;
    revision: number;
    favorites: (typeof favorite)[];
  };
  const config: Record<string, string | undefined> = {};
  const observed: {
    url: string;
    headers: IncomingMessage['headers'];
    body: unknown;
  }[] = [];
  beforeAll(async () => {
    upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : undefined;
      if (request.url === '/api/me/preferences') {
        const preferences = defaultAccountPreferences();
        preferences.content.showMatureContent = true;
        return json(response, {
          identityId: 'Alice',
          revision: 3,
          updatedAt: null,
          preferences,
        });
      }
      observed.push({ url: request.url ?? '', headers: request.headers, body });
      handler(request, response, body);
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    upstreamOrigin = `http://127.0.0.1:${
      (upstream.address() as AddressInfo).port
    }`;
    Object.assign(config, {
      EDITORIAL_URL: upstreamOrigin,
      DISCUSSION_URL: upstreamOrigin,
      ACCOUNT_MANAGEMENT_URL: upstreamOrigin,
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
    if (upstream)
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve()))
      );
  });
  beforeEach(() => {
    observed.length = 0;
    Object.assign(config, {
      EDITORIAL_URL: upstreamOrigin,
      DISCUSSION_URL: upstreamOrigin,
      ACCOUNT_MANAGEMENT_URL: upstreamOrigin,
      INGRESS_AUTH_SECRET: trusted['x-ingress-auth'],
    });
    saved = { identityId: 'Alice', revision: 3, favorites: [favorite] };
    handler = (request, response, body) => {
      const path = new URL(request.url ?? '', upstreamOrigin).pathname;
      if (path === '/api/me/favorites')
        return json(response, request.method === 'GET' ? saved : receipt);
      if (path.endsWith('/read'))
        return json(response, { id: (body as { id: string }).id, readAt: 20 });
      if (path.includes('/notifications'))
        return json(response, { enabled: true, items: [], next: null });
      if (path === '/api/catalog/app-selection')
        return json(response, { items: [appData] });
      return json(response, { items: [] });
    };
  });
  const call = (
    path = '/api/me/favorites',
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = trusted
  ) =>
    fetch(origin + path, {
      method,
      headers: {
        ...headers,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  it('forwards only trusted account context and returns private canonical references', async () => {
    const result = await call(undefined, 'GET', undefined, {
      ...trusted,
      authorization: 'Bearer secret',
      cookie: 'secret',
      'x-user-email': 'private@example.test',
      'x-notification-worker': 'secret',
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(saved);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(observed[0].headers).toMatchObject({
      'x-user-id': 'Alice',
      'x-user-claims': '{"roles":["member"]}',
      'x-ingress-auth': trusted['x-ingress-auth'],
    });
    for (const key of [
      'authorization',
      'cookie',
      'x-user-email',
      'x-notification-worker',
    ])
      expect(observed[0].headers[key]).toBeUndefined();
  });
  it.each(['/api/me/favorites', '/api/me/favorites/content', ...routes])(
    'rejects read bodies before service I/O on %s',
    async (path) => {
      for (const framing of ['Content-Length', 'Transfer-Encoding']) {
        const status = await new Promise<number | undefined>(
          (resolve, reject) => {
            const request = httpRequest(
              origin + path,
              {
                method: 'GET',
                headers: {
                  ...trusted,
                  'Content-Type': 'application/json',
                  [framing]: framing === 'Content-Length' ? '2' : 'chunked',
                },
              },
              (response) => {
                response.resume();
                response.on('end', () => resolve(response.statusCode));
              }
            );
            request.on('error', reject);
            request.end('{}');
          }
        );
        expect(status).toBe(400);
      }
      expect(observed).toHaveLength(0);
    }
  );
  it('preserves favorite command, revision and idempotency key', async () => {
    const result = await call(undefined, 'PUT', command, {
      ...trusted,
      'idempotency-key': 'save-once',
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(receipt);
    expect(observed[0].body).toEqual(command);
    expect(observed[0].headers['idempotency-key']).toBe('save-once');
  });
  it('does not retry an uncertain write and permits exact caller retry', async () => {
    let committed = false;
    handler = (_request, response) => {
      if (!committed) {
        committed = true;
        response.destroy();
      } else json(response, receipt);
    };
    expect(
      (
        await call(undefined, 'PUT', command, {
          ...trusted,
          'idempotency-key': 'same-command',
        })
      ).status
    ).toBe(503);
    expect(observed).toHaveLength(1);
    expect(
      (
        await call(undefined, 'PUT', command, {
          ...trusted,
          'idempotency-key': 'same-command',
        })
      ).status
    ).toBe(200);
    expect(observed[1].body).toEqual(observed[0].body);
    expect(observed[1].headers['idempotency-key']).toBe('same-command');
  });
  it.each([
    {},
    { ...trusted, 'x-ingress-auth': 'spoof' },
    { ...trusted, 'x-user-id': '' },
    { ...trusted, 'x-anonymous': 'true' },
  ])('rejects untrusted identity %# before service I/O', async (headers) => {
    expect((await call(undefined, 'GET', undefined, headers)).status).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each([
    { ...command, expectedRevision: 0 },
    { ...command, saved: 'true' },
    { ...command, target: { kind: 'applications', id: 'slug' } },
    { ...command, identityId: 'Bob' },
  ])('rejects malformed favorite command %#', async (body) => {
    expect(
      (
        await call(undefined, 'PUT', body, {
          ...trusted,
          'idempotency-key': 'save',
        })
      ).status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each(['', 'with space', 'x'.repeat(129)])(
    'rejects invalid favorite key %s',
    async (key) => {
      expect(
        (
          await call(undefined, 'PUT', command, {
            ...trusted,
            'idempotency-key': key,
          })
        ).status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([400, 401, 403, 404, 409, 413, 429])(
    'preserves owning-service status %s without leaking its body',
    async (status) => {
      handler = (_request, response) =>
        json(response, { message: 'database-secret' }, status);
      const result = await call();
      expect(result.status).toBe(status);
      expect(await result.text()).not.toContain('database-secret');
      expect(result.headers.get('cache-control')).toContain('no-store');
    }
  );
  it.each([
    { ...receipt, identityId: 'Bob' },
    { ...receipt, revision: 5 },
    { ...receipt, private: 'leak' },
  ])('rejects inconsistent write receipt %#', async (value) => {
    handler = (_request, response) => json(response, value);
    expect(
      (
        await call(undefined, 'PUT', command, {
          ...trusted,
          'idempotency-key': 'save',
        })
      ).status
    ).toBe(503);
  });
  it.each([
    'http://user:password@example.test',
    'http://example.test/path',
    'file:///tmp/account',
    undefined,
  ])('fails closed for invalid Account origin %s', async (value) => {
    config['ACCOUNT_MANAGEMENT_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it('rejects cross-account favorites and oversized responses', async () => {
    handler = (_request, response) =>
      json(response, { ...saved, identityId: 'Bob' });
    expect((await call()).status).toBe(503);
    handler = (_request, response) =>
      json(response, { secret: 'x'.repeat(65536) });
    expect((await call()).status).toBe(503);
  });
  it('does not follow dependency redirects', async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: upstreamOrigin + '/secret' });
      response.end();
    };
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it.each(routes)(
    'preserves cursor and mark-read semantics for %s',
    async (path) => {
      const cursor = `10.${id}`;
      const result = await call(path + '?cursor=' + cursor);
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({
        enabled: true,
        items: [],
        next: null,
      });
      expect(observed[0].url).toBe(path + '?cursor=' + cursor);
      const first = await call(path + '/read', 'PUT', { id });
      const again = await call(path + '/read', 'PUT', { id });
      expect(first.status).toBe(200);
      expect(await first.json()).toEqual(await again.json());
      expect(observed[1].headers['idempotency-key']).toBeUndefined();
      expect(observed[1].body).toEqual({ id });
    }
  );
  it.each(routes)(
    'rejects malformed or redirected inbox input on %s',
    async (path) => {
      for (const suffix of [
        '?uid=Bob',
        '?cursor=wrong',
        `?cursor=10.${id}&cursor=10.${second}`,
      ])
        expect((await call(path + suffix)).status).toBe(400);
      expect((await call(path + '/read?uid=Bob', 'PUT', { id })).status).toBe(
        400
      );
      expect(
        (await call(path + '/read', 'PUT', { id, identityId: 'Bob' })).status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each(routes)(
    'rejects malformed page and foreign receipt on %s',
    async (path) => {
      handler = (_request, response) =>
        json(response, { enabled: false, items: [], next: `10.${id}` });
      expect((await call(path)).status).toBe(503);
      handler = (_request, response) =>
        json(response, { id: second, readAt: 20 });
      expect((await call(path + '/read', 'PUT', { id })).status).toBe(503);
    }
  );
  it('composes saved content without sending account credentials to public readers', async () => {
    const result = await call('/api/me/favorites/content');
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      identityId: 'Alice',
      revision: 3,
      items: [
        {
          ...target,
          name: appData.name,
          slug: appData.slug,
          image: appData.logoUrl,
          classification: 'general',
          status: 'available',
        },
      ],
    });
    expect(
      observed.filter((request) => request.url === '/api/me/favorites')
    ).toHaveLength(2);
    const selection = observed.find((request) =>
      request.url.includes('selection')
    );
    expect(selection?.headers['x-user-id']).toBeUndefined();
    expect(selection?.headers['x-ingress-auth']).toBeUndefined();
  });
  it('joins parent visibility and classification for discussion references', async () => {
    saved.favorites = [{ kind: 'discussions', id: second, addedAt: 10 }];
    const original = handler;
    handler = (request, response, body) =>
      request.url?.startsWith('/api/discussions/selection')
        ? json(response, {
            items: [
              {
                id: second,
                bindingKey: 'application:' + id,
                revision: 1,
                replyCount: 0,
                pinned: false,
                canPin: false,
                comments: [
                  {
                    id: second,
                    parentId: null,
                    depth: 0,
                    content: {
                      title: 'Topic',
                      tags: [],
                      displayName: 'Alice',
                      text: 'Body',
                    },
                    createdAt: 10,
                    updatedAt: null,
                    editable: false,
                    removable: false,
                    votes: { upvotes: 0, downvotes: 0, mine: 0 },
                  },
                ],
              },
            ],
          })
        : original(request, response, body);
    const result = await call('/api/me/favorites/content');
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      items: [
        {
          kind: 'discussions',
          id: second,
          slug: second,
          appSlug: 'current-app',
          classification: 'general',
        },
      ],
    });
  });
  it('keeps unavailable references removable and fails truthfully on metadata outage', async () => {
    const original = handler;
    handler = (request, response, body) =>
      request.url?.includes('selection')
        ? json(response, { items: [] })
        : original(request, response, body);
    expect(
      await (await call('/api/me/favorites/content')).json()
    ).toMatchObject({
      items: [{ ...target, status: 'unavailable', slug: null }],
    });
    handler = (request, response, body) =>
      request.url?.includes('selection')
        ? json(response, {}, 503)
        : original(request, response, body);
    expect((await call('/api/me/favorites/content')).status).toBe(503);
    expect(
      (
        await call(
          undefined,
          'PUT',
          { ...command, saved: false },
          { ...trusted, 'idempotency-key': 'remove' }
        )
      ).status
    ).toBe(200);
  });
  it('rejects changed saved references after metadata I/O', async () => {
    const original = handler;
    handler = (request, response, body) => {
      if (request.url?.includes('selection')) saved.revision++;
      original(request, response, body);
    };
    expect((await call('/api/me/favorites/content')).status).toBe(409);
  });
  it.each(['applications', 'articles', 'suites', 'discussions'])(
    'bounds %s resolution to fifty IDs per service call',
    async (kind) => {
      saved.favorites = Array.from({ length: 200 }, (_, index) => ({
        kind,
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        addedAt: 10,
      }));
      const original = handler;
      handler = (request, response, body) =>
        request.url?.includes('selection')
          ? json(response, { items: [] })
          : original(request, response, body);
      const result = await call('/api/me/favorites/content');
      expect(result.status).toBe(200);
      expect(parseFavoriteContent(await result.json()).items).toHaveLength(200);
      const selections = observed.filter((request) =>
        request.url.includes('selection')
      );
      expect(selections).toHaveLength(4);
      for (const request of selections)
        expect(
          new URL(request.url, upstreamOrigin).searchParams
            .get('ids')
            ?.split(',')
        ).toHaveLength(50);
    }
  );
  it('rejects arbitrary target selectors and response metadata', async () => {
    expect((await call('/api/me/favorites/content?ids=' + second)).status).toBe(
      400
    );
    const original = handler;
    handler = (request, response, body) =>
      request.url?.includes('selection')
        ? json(response, { items: [{ ...appData, id: second }] })
        : original(request, response, body);
    expect((await call('/api/me/favorites/content')).status).toBe(503);
  });
});
