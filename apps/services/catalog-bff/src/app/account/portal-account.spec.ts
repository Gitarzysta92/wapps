import { createHash } from 'node:crypto';
import {
  createServer,
  request as httpRequest,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';

const secret = 'test-portal-account-secret';
const id = '00000000-0000-4000-8000-000000000001';
const photo = Buffer.from('524946460c000000574542505650384c00000000', 'hex');
const snapshot = {
  identityId: 'Alice',
  publicId: id,
  revision: 4,
  registeredAt: 1,
  updatedAt: 4,
  profile: {
    name: 'Alice',
    bio: 'Member bio',
    location: 'Warsaw',
    contactEmail: 'contact@example.test',
    avatarUri: null,
    avatarId: id,
    socialLinks: { github: 'alice' },
  },
};
const summary = {
  uid: 'Alice',
  identityId: 'Alice',
  subjectId: id,
  revision: 4,
  account: {
    status: 'ACTIVE',
    createdAt: 1,
    updatedAt: 4,
    registeredAt: 1,
    email: 'alice@example.test',
  },
  profile: {
    name: 'Alice',
    bio: 'Member bio',
    location: 'Warsaw',
    avatar: null,
  },
};
const update = {
  expectedRevision: 4,
  name: 'Alice',
  bio: 'Updated bio',
  location: null,
  contactEmail: 'contact@example.test',
  socialLinks: { github: 'alice' },
};
const receipt = { identityId: 'Alice', revision: 5 };
const erasure = {
  identityId: 'Alice',
  revision: 5,
  status: 'accepted',
  cleanup: 'pending',
};
const trusted: Record<string, string> = {
  'x-ingress-auth': secret,
  'x-user-id': 'Alice',
  'x-user-email': 'alice@example.test',
  'x-user-claims': JSON.stringify({
    roles: ['member'],
    tenantId: 'default',
    private: 'discard',
  }),
};
const photoHeaders = {
  'idempotency-key': 'photo-command',
  'if-match': '"4"',
  'content-type': 'image/webp',
  'x-avatar-bytes': String(photo.length),
  'x-avatar-sha256': createHash('sha256').update(photo).digest('hex'),
};
type Handler = (request: IncomingMessage, response: ServerResponse) => void;
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

describe('account and private profile through BFF and Account HTTP', () => {
  let app: INestApplication,
    account: Server,
    origin: string,
    accountOrigin: string;
  let handler: Handler;
  const config: Record<string, string | undefined> = {};
  const observed: {
    path?: string;
    method?: string;
    headers: IncomingMessage['headers'];
    bytes: Buffer;
  }[] = [];
  beforeAll(async () => {
    account = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      observed.push({
        path: request.url,
        method: request.method,
        headers: request.headers,
        bytes: Buffer.concat(chunks),
      });
      handler(request, response);
    });
    await new Promise<void>((resolve) =>
      account.listen(0, '127.0.0.1', resolve)
    );
    accountOrigin = `http://127.0.0.1:${
      (account.address() as AddressInfo).port
    }`;
    config['EDITORIAL_URL'] = accountOrigin;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => config[key] })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true })
    );
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
    if (account)
      await new Promise<void>((resolve, reject) =>
        account.close((error) => (error ? reject(error) : resolve()))
      );
  });
  beforeEach(() => {
    observed.length = 0;
    config['ACCOUNT_MANAGEMENT_URL'] = accountOrigin;
    config['INGRESS_AUTH_SECRET'] = secret;
    handler = (request, response) => {
      if (request.method === 'GET' && request.url?.includes('/avatar/')) {
        response.writeHead(200, { 'content-type': 'image/webp' });
        response.end(photo);
      } else if (request.url === '/api/me') {
        json(
          response,
          request.method === 'DELETE' ? 202 : 200,
          request.method === 'DELETE' ? erasure : summary
        );
      } else json(response, 200, request.method === 'GET' ? snapshot : receipt);
    };
  });
  const call = (
    path = '/api/me',
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = trusted
  ) =>
    fetch(origin + path, {
      method,
      headers: {
        ...headers,
        ...(body !== undefined && !Buffer.isBuffer(body)
          ? { 'content-type': 'application/json' }
          : {}),
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
    });

  it('reads canonical account details with trusted email context and no ambient credentials', async () => {
    const response = await call('/api/me', 'GET', undefined, {
      ...trusted,
      authorization: 'Bearer private',
      cookie: 'private',
      'x-notification-worker': 'private',
      'x-auth-time': '123',
      'x-account-erasure': 'private',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual(summary);
    expect(observed[0].headers).toMatchObject({
      'x-user-email': 'alice@example.test',
      'x-user-id': 'Alice',
      'x-user-claims': JSON.stringify({
        tenantId: 'default',
        roles: ['member'],
      }),
    });
    for (const name of [
      'authorization',
      'cookie',
      'x-auth-time',
      'x-notification-worker',
      'x-account-erasure',
    ])
      expect(observed[0].headers[name]).toBeUndefined();
  });

  it.each(
    ['/api/me', '/api/me/profile', `/api/me/profile/avatar/${id}`].flatMap(
      (path) =>
        ['content-length', 'transfer-encoding'].map((framing) => [
          path,
          framing,
        ])
    )
  )('rejects GET bodies before Account I/O: %s (%s)', async (path, framing) => {
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

  it('supports a canonical unregistered account without inventing a profile or email', async () => {
    const value = {
      ...summary,
      account: {
        status: 'STUB',
        createdAt: 1,
        updatedAt: 1,
        registeredAt: null,
      },
      profile: { name: null, bio: null, location: null, avatar: null },
    };
    handler = (_request, response) => json(response, 200, value);
    const headers = { ...trusted };
    delete headers['x-user-email'];
    const response = await call('/api/me', 'GET', undefined, headers);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(value);
  });

  it('reads private profile fields without forwarding credential email', async () => {
    const response = await call('/api/me/profile');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(observed[0].headers['x-user-email']).toBeUndefined();
  });

  it('preserves profile revision, command key and optional contact-email omission', async () => {
    const body = { ...update };
    delete (body as Partial<typeof update>).contactEmail;
    const response = await call('/api/me/profile', 'PUT', body, {
      ...trusted,
      'idempotency-key': 'text-command',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(receipt);
    expect(JSON.parse(observed[0].bytes.toString())).toEqual(body);
    expect(observed[0].headers['idempotency-key']).toBe('text-command');
    expect(observed).toHaveLength(1);
  });

  it('preserves accepted erasure semantics on the shared /me route without retry', async () => {
    const response = await call('/api/me', 'DELETE');
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(erasure);
    expect(observed).toHaveLength(1);
    expect(observed[0].bytes.length).toBe(0);
    expect(observed[0].headers['x-user-email']).toBeUndefined();
  });

  it('forwards byte-identical photo upload with its original checksum, revision and key', async () => {
    const response = await call('/api/me/profile/avatar', 'PUT', photo, {
      ...trusted,
      ...photoHeaders,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(receipt);
    expect(observed).toHaveLength(1);
    expect(observed[0].bytes).toEqual(photo);
    expect(observed[0].headers).toMatchObject(photoHeaders);
    expect(observed[0].headers['x-user-email']).toBeUndefined();
  });

  it('returns bounded private WebP bytes with defensive response headers', async () => {
    const response = await call('/api/me/profile/avatar/' + id);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toContain(
      'sandbox'
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(photo);
  });

  it('removes a photo with revision and command identity and no invented body', async () => {
    const response = await call('/api/me/profile/avatar', 'DELETE', undefined, {
      ...trusted,
      'if-match': '"4"',
      'idempotency-key': 'delete-command',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(receipt);
    expect(observed[0].bytes.length).toBe(0);
    expect(observed[0].headers).toMatchObject({
      'if-match': '"4"',
      'idempotency-key': 'delete-command',
    });
  });

  it.each([
    ['/api/me', 'GET'],
    ['/api/me', 'DELETE'],
    ['/api/me/profile', 'GET'],
    ['/api/me/profile', 'PUT'],
    ['/api/me/profile/avatar', 'PUT'],
    ['/api/me/profile/avatar', 'DELETE'],
    ['/api/me/profile/avatar/' + id, 'GET'],
  ])(
    'rejects unauthenticated access before downstream I/O: %s %s',
    async (path, method) => {
      expect((await call(path, method, undefined, {})).status).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );

  it.each<Record<string, string>>([
    { ...trusted, 'x-ingress-auth': 'forged' },
    { ...trusted, 'x-anonymous': 'true' },
    { ...trusted, 'x-user-claims': '{"roles":[1]}' },
  ])('rejects forged or malformed identity context', async (headers) => {
    expect([400, 401]).toContain(
      (await call('/api/me', 'GET', undefined, headers)).status
    );
    expect(observed).toHaveLength(0);
  });

  it.each(['x-user-email', 'idempotency-key', 'if-match', 'x-avatar-sha256'])(
    'rejects duplicate identity/command headers: %s',
    async (name) => {
      const path =
        name === 'x-user-email' ? '/api/me' : '/api/me/profile/avatar';
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const request = httpRequest(
            origin + path,
            {
              method: name === 'x-user-email' ? 'GET' : 'PUT',
              headers: {
                ...trusted,
                ...photoHeaders,
                [name]: [
                  name === 'x-user-email'
                    ? 'alice@example.test'
                    : photoHeaders[name as keyof typeof photoHeaders],
                  'duplicate',
                ],
              },
            },
            (response) => {
              response.resume();
              response.on('end', () => resolve(response.statusCode));
            }
          );
          request.on('error', reject);
          request.end(name === 'x-user-email' ? undefined : photo);
        }
      );
      expect(status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );

  it.each([
    { ...update, owner: 'Bob' },
    { ...update, expectedRevision: '4' },
    { ...update, name: '' },
  ])('rejects malformed profile commands before Account I/O', async (body) => {
    expect(
      (
        await call('/api/me/profile', 'PUT', body, {
          ...trusted,
          'idempotency-key': 'command',
        })
      ).status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it('rejects body/query account selection and missing text command keys', async () => {
    expect((await call('/api/me?identityId=Bob')).status).toBe(400);
    expect((await call('/api/me/profile?identityId=Bob')).status).toBe(400);
    expect(
      (await call('/api/me', 'DELETE', { identityId: 'Bob' })).status
    ).toBe(400);
    expect((await call('/api/me/profile', 'PUT', update)).status).toBe(400);
    expect((await call('/api/me/profile/avatar/not-an-id')).status).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each([
    [{ 'content-type': 'image/svg+xml' }, 415],
    [{ 'content-encoding': 'gzip' }, 415],
    [{ 'x-avatar-bytes': '2097153' }, 413],
    [{ 'x-avatar-bytes': '0' }, 400],
    [{ 'x-avatar-sha256': 'bad' }, 400],
    [{ 'x-avatar-sha256': '0'.repeat(64) }, 400],
    [{ 'x-avatar-bytes': '1' }, 400],
    [{ 'if-match': '4' }, 400],
    [{ 'if-match': '"9007199254740992"' }, 400],
  ] as [Record<string, string>, number][])(
    'rejects invalid photo envelopes %j',
    async (headers, status) => {
      expect(
        (
          await call('/api/me/profile/avatar', 'PUT', photo, {
            ...trusted,
            ...photoHeaders,
            ...headers,
          })
        ).status
      ).toBe(status);
      expect(observed).toHaveLength(0);
    }
  );

  it('bounds chunked bodies even when declared byte count is small', async () => {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        origin + '/api/me/profile/avatar',
        {
          method: 'PUT',
          headers: {
            ...trusted,
            ...photoHeaders,
            'transfer-encoding': 'chunked',
          },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        }
      );
      request.on('error', reject);
      request.end(Buffer.alloc(2 * 1024 * 1024 + 1));
    });
    expect(status).toBe(413);
    expect(observed).toHaveLength(0);
  });

  it.each([400, 401, 403, 404, 409, 413, 415, 429])(
    'preserves status %s without leaking service diagnostics',
    async (status) => {
      handler = (_request, response) =>
        json(response, status, { message: 'private SQL detail' });
      const response = await call('/api/me/profile', 'PUT', update, {
        ...trusted,
        'idempotency-key': 'command',
      });
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain('private SQL');
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
  );

  it.each([
    { ...summary, uid: 'Bob' },
    { ...summary, extraSecret: 'private' },
    { ...summary, account: { ...summary.account, status: ['ACTIVE'] } },
    { ...summary, account: { ...summary.account, email: 'bob@example.test' } },
    { ...summary, account: { ...summary.account, status: 'SUSPENDED' } },
    { ...summary, account: { ...summary.account, registeredAt: null } },
    { ...summary, account: { ...summary.account, createdAt: 5 } },
  ])('fails closed for malformed or cross-account summary', async (value) => {
    handler = (_request, response) => json(response, 200, value);
    expect((await call()).status).toBe(503);
  });

  it.each([
    { ...snapshot, identityId: 'Bob' },
    { ...snapshot, privateData: 'unexpected' },
  ])('rejects invalid private profile snapshots', async (value) => {
    handler = (_request, response) => json(response, 200, value);
    expect((await call('/api/me/profile')).status).toBe(503);
  });

  it.each([
    { identityId: 'Bob', revision: 5 },
    { identityId: 'Alice', revision: 4 },
  ])('rejects invalid mutation receipts', async (value) => {
    handler = (_request, response) => json(response, 200, value);
    expect(
      (
        await call('/api/me/profile', 'PUT', update, {
          ...trusted,
          'idempotency-key': 'command',
        })
      ).status
    ).toBe(503);
    expect(
      (
        await call('/api/me/profile/avatar', 'PUT', photo, {
          ...trusted,
          ...photoHeaders,
        })
      ).status
    ).toBe(503);
  });

  it.each([
    { ...erasure, identityId: 'Bob' },
    { ...erasure, cleanup: 'unknown' },
    { ...erasure, cleanup: ['pending'] },
  ])('rejects invalid erasure receipts', async (value) => {
    handler = (_request, response) => json(response, 202, value);
    expect((await call('/api/me', 'DELETE')).status).toBe(503);
  });

  it.each([
    ['text/html', photo],
    ['image/webp', Buffer.from('not a valid webp image')],
    ['image/webp', Buffer.alloc(256 * 1024 + 1)],
  ] as [string, Buffer][])(
    'rejects invalid photo responses %s',
    async (type, bytes) => {
      handler = (_request, response) => {
        response.writeHead(200, { 'content-type': type });
        response.end(bytes);
      };
      expect((await call('/api/me/profile/avatar/' + id)).status).toBe(503);
    }
  );

  it('does not follow upstream redirects or accept oversized JSON', async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: accountOrigin + '/private' });
      response.end();
    };
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(1);
    handler = (_request, response) =>
      json(response, 200, { data: 'x'.repeat(65536) });
    expect((await call()).status).toBe(503);
  });

  it.each([
    [
      '/api/me/profile',
      'PUT',
      update,
      { 'idempotency-key': 'same-text-command' },
    ],
    ['/api/me/profile/avatar', 'PUT', photo, photoHeaders],
    [
      '/api/me/profile/avatar',
      'DELETE',
      undefined,
      { 'idempotency-key': 'same-removal', 'if-match': '"4"' },
    ],
    ['/api/me', 'DELETE', undefined, {}],
  ] as [string, string, unknown, Record<string, string>][])(
    'leaves retry ownership with the caller after a lost %s %s reply',
    async (path, method, body, headers) => {
      handler = (request) => {
        request.socket.destroy();
      };
      const failed = await call(path, method, body, { ...trusted, ...headers });
      expect(failed.status).toBe(503);
      expect(failed.headers.get('retry-after')).toBe('2');
      expect(observed).toHaveLength(1);
      handler = (_request, response) =>
        json(
          response,
          path === '/api/me' ? 202 : 200,
          path === '/api/me' ? erasure : receipt
        );
      expect(
        (await call(path, method, body, { ...trusted, ...headers })).status
      ).toBe(path === '/api/me' ? 202 : 200);
      expect(observed).toHaveLength(2);
      expect(observed[1].bytes).toEqual(observed[0].bytes);
      expect(observed[1].headers['idempotency-key']).toBe(
        observed[0].headers['idempotency-key']
      );
    }
  );

  it.each([
    undefined,
    'http://user:password@account.test',
    'http://account.test/private',
    'file:///private',
  ])('fails closed for invalid Account origin %s', async (value) => {
    config['ACCOUNT_MANAGEMENT_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
});
