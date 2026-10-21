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

const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const trusted = {
  'x-ingress-auth': 'profile-test-ingress',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims': '{"roles":["member"],"ignored":"secret"}',
};
const anonymous = {
  'x-ingress-auth': trusted['x-ingress-auth'],
  'x-anonymous': 'true',
};
const profile = {
  id,
  name: 'Public member',
  bio: null,
  location: null,
  socialLinks: {},
  avatarId: other,
  registeredAt: 10,
  contactEmail: null,
};
const view = { access: 'visible', profile, isOwner: false, follow: null };
const totals = { discussions: 1, favorites: 2, suites: 3, articles: 4 };
const empty = { sharing: 'visible', items: [], after: null };
const badge = {
  expectedRevision: 0,
  kind: 'verified',
  action: 'award',
  reason: 'Local test approval',
};
const badgeEvent = {
  profileId: id,
  revision: 1,
  kind: 'verified',
  action: 'award',
  reason: badge.reason,
  actorId: other,
  at: 10,
};
const history = {
  profileId: id,
  revision: 0,
  badges: [],
  name: 'Public member',
  active: true,
  events: [],
  after: null,
};
const follow = {
  ownerId: id,
  requesterId: other,
  expectedRevision: 0,
  action: 'request',
};
const followReceipt = {
  ownerId: id,
  requesterId: other,
  revision: 1,
  status: 'pending',
};
const photo = Buffer.from('524946460400000057454250', 'hex');
const sections = [
  'favorites',
  'suites',
  'articles',
  'discussions',
  'activity',
] as const;
const sharedItems: Record<(typeof sections)[number], unknown> = {
  favorites: {
    classification: 'general',
    kind: 'applications',
    id: other,
    title: 'Public application',
    slug: 'public-application',
    applicationSlug: null,
  },
  suites: {
    classification: 'general',
    id: other,
    title: 'Public suite',
    description: 'Useful tools',
  },
  articles: {
    classification: 'general',
    id: other,
    title: 'Public article',
    excerpt: 'An introduction',
    slug: 'public-article',
    publishedAt: 10,
  },
  discussions: {
    classification: 'general',
    id: other,
    parentKind: 'application',
    parentId: id,
    parentSlug: 'public-application',
    title: 'Public topic',
    createdAt: 10,
    replyCount: 2,
    participation: 'author',
  },
  activity: {
    classification: 'general',
    kind: 'article',
    id: other,
    at: 10,
    title: 'Public article',
    target: { kind: 'article', id: other, slug: 'public-article' },
  },
};
const reads = [
  ['/api/profiles', { profiles: [profile], after: null }],
  [`/api/profiles/${id}`, view],
  ...sections.map(
    (section) => [`/api/profiles/${id}/${section}`, empty] as const
  ),
  [`/api/profiles/${id}/totals`, totals],
  [`/api/profiles/${id}/badges`, { sharing: 'visible', items: [] }],
  ['/api/me/totals', totals],
  ['/api/me/badges', { sharing: 'visible', items: [] }],
  ['/api/me/profile-follows', { followers: [], after: null }],
  ['/api/me/profile-follows/outgoing', { following: [], after: null }],
  ['/api/admin/profile-badges', { kinds: ['verified', 'premium'] }],
  [`/api/admin/profile-badges/${id}`, history],
] as const;
const json = (response: ServerResponse, value: unknown, status = 200) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
};
type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown
) => void;

describe('public profiles and social commands through the production BFF', () => {
  let app: INestApplication,
    upstream: Server,
    origin: string,
    upstreamOrigin: string;
  let handler: Handler;
  const config: Record<string, string | undefined> = {};
  const observed: {
    url: string;
    method: string | undefined;
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
      observed.push({
        url: request.url ?? '',
        method: request.method,
        headers: request.headers,
        body,
      });
      handler(request, response, body);
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    upstreamOrigin = `http://127.0.0.1:${
      (upstream.address() as AddressInfo).port
    }`;
    Object.assign(config, {
      ACCOUNT_MANAGEMENT_URL: upstreamOrigin,
      EDITORIAL_URL: upstreamOrigin,
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
    config['ACCOUNT_MANAGEMENT_URL'] = upstreamOrigin;
    config['INGRESS_AUTH_SECRET'] = trusted['x-ingress-auth'];
    handler = (request, response) => {
      const path = new URL(request.url ?? '', upstreamOrigin).pathname;
      if (path.includes('/avatar/')) {
        response.writeHead(200, { 'content-type': 'image/webp' });
        response.end(photo);
        return;
      }
      if (request.method === 'PUT')
        return json(
          response,
          path.includes('/admin/') ? badgeEvent : followReceipt
        );
      const read = reads.find(([route]) => route === path);
      return json(response, read?.[1] ?? {}, read ? 200 : 404);
    };
  });
  function call(
    path: string,
    headers: Record<string, string> = trusted,
    body?: unknown
  ) {
    return fetch(origin + path, {
      method: body === undefined ? 'GET' : 'PUT',
      headers: {
        ...headers,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  it.each(
    [
      ...reads.map(([path]) => path),
      `/api/profiles/${id}/avatar/${other}`,
    ].flatMap((path) =>
      ['content-length', 'transfer-encoding'].map((framing) => [path, framing])
    )
  )('rejects GET bodies before owner I/O: %s (%s)', async (path, framing) => {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        origin + path,
        {
          method: 'GET',
          headers: {
            ...trusted,
            'content-type': 'application/json',
            [framing]: framing === 'content-length' ? '2' : 'chunked',
          },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        }
      );
      request.on('error', reject);
      request.end('{}');
    });
    expect(status).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each(reads)(
    'serves and validates the fixed contract %s',
    async (path, expected) => {
      const response = await call(path);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(expected);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(path);
    }
  );
  it.each(sections)(
    'preserves populated shared %s metadata',
    async (section) => {
      const page = { ...empty, items: [sharedItems[section]] };
      handler = (_request, response) => json(response, page);
      const response = await call(`/api/profiles/${id}/${section}`, anonymous);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(page);
    }
  );
  it.each(['suites', 'articles'] as const)(
    'rejects %s records preceding the requested continuation',
    async (section) => {
      handler = (_request, response) =>
        json(response, { ...empty, items: [sharedItems[section]] });
      expect(
        (await call(`/api/profiles/${id}/${section}?after=${other}`)).status
      ).toBe(503);
    }
  );
  it('permits trusted anonymous profiles while excluding user credentials', async () => {
    const response = await call(`/api/profiles/${id}`, anonymous);
    expect(response.status).toBe(200);
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(observed[0].headers).toMatchObject(anonymous);
    for (const key of [
      'x-user-id',
      'x-user-claims',
      'authorization',
      'cookie',
      'x-user-email',
    ])
      expect(observed[0].headers[key]).toBeUndefined();
  });
  it('forwards only verified viewer context for signed-in profile reads', async () => {
    const response = await call(`/api/profiles/${id}`, {
      ...trusted,
      authorization: 'Bearer secret',
      cookie: 'secret',
      'x-notification-worker': 'secret',
      'x-user-email': 'secret@test.test',
    });
    expect(response.status).toBe(200);
    expect(observed[0].headers['x-user-claims']).toBe('{"roles":["member"]}');
    for (const key of [
      'authorization',
      'cookie',
      'x-notification-worker',
      'x-user-email',
    ])
      expect(observed[0].headers[key]).toBeUndefined();
  });
  it.each([
    {},
    { ...anonymous, 'x-ingress-auth': 'forged' },
    { ...anonymous, 'x-user-id': 'Alice' },
    { ...anonymous, 'x-user-claims': '{}' },
    { ...anonymous, authorization: 'Bearer invalid' },
    { ...anonymous, 'x-user-email': 'private@test.test' },
    { ...anonymous, 'x-auth-time': '1' },
  ])(
    'rejects conflicting or untrusted anonymous identity %#',
    async (headers) => {
      expect((await call(`/api/profiles/${id}`, headers)).status).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    '/api/me/totals',
    '/api/me/badges',
    '/api/me/profile-follows',
    '/api/me/profile-follows/outgoing',
    '/api/admin/profile-badges',
  ])('keeps %s unavailable to anonymous viewers', async (path) => {
    expect((await call(path, anonymous)).status).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each([
    `/api/profiles/not-a-profile`,
    `/api/profiles/${id}/avatar/credential-id`,
    '/api/profiles?identityId=Bob',
    '/api/profiles?after[]=wrong',
    `/api/profiles?after=${id}&after=${other}`,
    `/api/profiles/${id}?after=${other}`,
    `/api/profiles/${id}/totals?ownerId=Bob`,
    `/api/profiles/${id}/favorites?after=${id}`,
    `/api/profiles/${id}/activity?after=invalid`,
    `/api/profiles/${id}/discussions?after=invalid`,
    `/api/admin/profile-badges/${id}?after=0`,
  ])('rejects invalid path/query %s before I/O', async (path) => {
    expect((await call(path)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    ['/api/profiles', id],
    [`/api/profiles/${id}/suites`, id],
    [`/api/profiles/${id}/articles`, id],
    [`/api/profiles/${id}/favorites`, `applications:${id}`],
    [`/api/profiles/${id}/activity`, 'a1.' + 'a'.repeat(40)],
    [`/api/profiles/${id}/discussions`, 'v1.' + 'a'.repeat(40)],
    ['/api/me/profile-follows', id],
    ['/api/me/profile-follows/outgoing', id],
    [`/api/admin/profile-badges/${id}`, '10'],
  ])('preserves the typed cursor for %s', async (path, after) => {
    handler = (_request, response) =>
      json(
        response,
        path === '/api/profiles'
          ? { profiles: [], after: null }
          : reads.find(([route]) => route === path)?.[1]
      );
    expect(
      (await call(path + '?after=' + encodeURIComponent(after))).status
    ).toBe(200);
    expect(
      new URL(observed[0].url, upstreamOrigin).searchParams.get('after')
    ).toBe(after);
  });
  it.each([400, 401, 403, 404, 409, 413, 429, 503])(
    'preserves safe dependency status %s without diagnostics',
    async (status) => {
      handler = (_request, response) =>
        json(response, { message: 'private SQL diagnostics' }, status);
      const response = await call(`/api/profiles/${id}`);
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain('SQL');
      expect(response.headers.get('cache-control')).toContain('no-store');
      if ([429, 503].includes(status))
        expect(response.headers.get('retry-after')).toBe('2');
    }
  );
  it.each([
    undefined,
    'http://user:secret@test.test',
    'http://test.test/path',
    'file:///private',
  ])('fails closed for invalid Account origin %s', async (value) => {
    config['ACCOUNT_MANAGEMENT_URL'] = value;
    expect((await call(`/api/profiles/${id}`)).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it('does not follow redirects or expose oversized response data', async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: upstreamOrigin + '/private' });
      response.end();
    };
    expect((await call('/api/profiles')).status).toBe(503);
    expect(observed).toHaveLength(1);
    handler = (_request, response) =>
      json(response, { secret: 'x'.repeat(1024 * 1024) });
    expect((await call('/api/profiles')).status).toBe(503);
  });
  it.each([
    [`/api/profiles/${id}`, { ...view, profile: { ...profile, id: other } }],
    [`/api/profiles/${id}`, { ...view, privateEmail: 'leak' }],
    [
      '/api/profiles',
      {
        profiles: [{ ...profile, contactEmail: 'private@test.test' }],
        after: null,
      },
    ],
    [`/api/profiles?after=${id}`, { profiles: [profile], after: id }],
    ['/api/me/totals', { ...totals, articles: null }],
    ['/api/me/badges', { sharing: 'hidden', items: [] }],
    [
      `/api/profiles/${id}/favorites`,
      {
        sharing: 'hidden',
        items: [
          {
            kind: 'applications',
            id,
            title: 'Secret',
            slug: 'secret',
            applicationSlug: null,
          },
        ],
        after: null,
      },
    ],
    [`/api/admin/profile-badges/${id}`, { ...history, profileId: other }],
    [
      '/api/admin/profile-badges',
      { kinds: ['verified', 'premium'], roles: ['admin'] },
    ],
    [
      '/api/me/profile-follows',
      {
        followers: [
          { ...followReceipt, requesterName: 'Member' },
          { ...followReceipt, requesterName: 'Member' },
        ],
        after: null,
      },
    ],
  ])('rejects malformed or mis-scoped response for %s', async (path, value) => {
    handler = (_request, response) => json(response, value);
    expect((await call(path)).status).toBe(503);
  });
  it('rejects an owner or follower response for an anonymous viewer', async () => {
    handler = (_request, response) =>
      json(response, { ...view, isOwner: true });
    expect((await call(`/api/profiles/${id}`, anonymous)).status).toBe(503);
  });
  it('preserves hidden shared totals and content instead of inventing zeros', async () => {
    handler = (_request, response) =>
      json(response, { ...totals, favorites: null });
    expect(await (await call(`/api/profiles/${id}/totals`)).json()).toEqual({
      ...totals,
      favorites: null,
    });
    for (const section of sections) {
      handler = (_request, response) =>
        json(response, { sharing: 'hidden', items: [], after: null });
      expect((await call(`/api/profiles/${id}/${section}`)).status).toBe(200);
    }
  });
  it.each([
    ['/api/me/profile-follows', follow, followReceipt],
    [`/api/admin/profile-badges/${id}`, badge, badgeEvent],
  ])(
    'preserves command keys, revisions and lost-response retry for %s',
    async (path, input, receipt) => {
      handler = (_request, response) => response.destroy();
      const headers = { ...trusted, 'idempotency-key': 'same-command' };
      expect((await call(path, headers, input)).status).toBe(503);
      expect(observed).toHaveLength(1);
      handler = (_request, response) => json(response, receipt);
      expect(await (await call(path, headers, input)).json()).toEqual(receipt);
      expect(observed).toHaveLength(2);
      for (const request of observed) {
        expect(request.body).toEqual(input);
        expect(request.headers['idempotency-key']).toBe('same-command');
        expect(request.method).toBe('PUT');
      }
    }
  );
  it.each([
    ['/api/me/profile-follows', follow],
    [`/api/admin/profile-badges/${id}`, badge],
  ])(
    'rejects anonymous, invalid key and extra command fields for %s',
    async (path, input) => {
      expect((await call(path, anonymous, input)).status).toBe(401);
      expect((await call(path, trusted, input)).status).toBe(400);
      expect(
        (
          await call(
            path,
            { ...trusted, 'idempotency-key': 'with space' },
            input
          )
        ).status
      ).toBe(400);
      expect(
        (
          await call(
            path,
            { ...trusted, 'idempotency-key': 'valid' },
            { ...input, identityId: 'Bob' }
          )
        ).status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    [
      '/api/me/profile-follows',
      follow,
      { ...followReceipt, requesterId: id, ownerId: other },
    ],
    ['/api/me/profile-follows', follow, { ...followReceipt, revision: 2 }],
    [
      '/api/me/profile-follows',
      follow,
      { ...followReceipt, status: 'approved' },
    ],
    [
      `/api/admin/profile-badges/${id}`,
      badge,
      { ...badgeEvent, reason: 'A different reason' },
    ],
    [`/api/admin/profile-badges/${id}`, badge, { ...badgeEvent, revision: 2 }],
    [
      `/api/admin/profile-badges/${id}`,
      badge,
      { ...badgeEvent, profileId: other },
    ],
  ])(
    'rejects mismatched command receipts for %s',
    async (path, input, receipt) => {
      handler = (_request, response) => json(response, receipt);
      expect(
        (await call(path, { ...trusted, 'idempotency-key': 'valid' }, input))
          .status
      ).toBe(503);
    }
  );
  it('validates audience-protected WebP reads and response security headers', async () => {
    const response = await call(
      `/api/profiles/${id}/avatar/${other}`,
      anonymous
    );
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(photo);
    expect(response.headers.get('content-type')).toContain('image/webp');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toContain(
      'sandbox'
    );
    expect(response.headers.get('vary')).toBe('Authorization');
    handler = (_request, result) => {
      result.writeHead(200, { 'content-type': 'image/webp' });
      result.end('not an image');
    };
    expect((await call(`/api/profiles/${id}/avatar/${other}`)).status).toBe(
      503
    );
    handler = (_request, result) => {
      result.writeHead(200, { 'content-type': 'image/webp' });
      result.end(Buffer.alloc(256 * 1024 + 1));
    };
    expect((await call(`/api/profiles/${id}/avatar/${other}`)).status).toBe(
      503
    );
  });
});
