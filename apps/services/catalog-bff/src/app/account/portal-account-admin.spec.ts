import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;
const secret = 'account-administration-test-secret';
const trusted = {
  'x-ingress-auth': secret,
  'x-user-id': 'Operator',
  'x-user-claims': JSON.stringify({
    roles: ['identity:admin'],
    tenantId: 'Tenant',
    private: 'discard',
  }),
};

describe('account administration BFF HTTP boundary', () => {
  let app: INestApplication, owner: Server, origin: string, ownerOrigin: string;
  let handler: Handler;
  const config: Record<string, string | undefined> = {};
  const observed: {
    path?: string;
    method?: string;
    headers: IncomingMessage['headers'];
    body: string;
  }[] = [];
  const json = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };
  beforeAll(async () => {
    owner = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      observed.push({
        path: request.url,
        method: request.method,
        headers: request.headers,
        body: Buffer.concat(chunks).toString(),
      });
      handler(request, response);
    });
    await new Promise<void>((resolve) => owner.listen(0, '127.0.0.1', resolve));
    ownerOrigin = `http://127.0.0.1:${(owner.address() as AddressInfo).port}`;
    config['EDITORIAL_URL'] = ownerOrigin;
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
    owner?.closeAllConnections();
    await new Promise<void>((resolve) => owner.close(() => resolve()));
  });
  beforeEach(() => {
    observed.length = 0;
    config['INGRESS_AUTH_SECRET'] = secret;
    config['ACCOUNT_MANAGEMENT_URL'] = ownerOrigin;
    handler = (_request, response) => json(response, 201, { disabled: true });
  });
  const call = (
    action = 'disable',
    options: RequestInit = {},
    uid = 'local:Case-Sensitive'
  ) =>
    fetch(`${origin}/api/admin/users/${encodeURIComponent(uid)}/${action}`, {
      method: 'POST',
      headers: trusted,
      ...options,
    });

  const target = 'local:Case-Sensitive';
  const deletion = {
    identityId: target,
    revision: 2,
    status: 'accepted',
    cleanup: 'pending',
  };
  const identity = {
    identityId: target,
    subjectId: 'internal-node',
    revision: 1,
    isActive: true,
    isSuspended: false,
    isDeleted: false,
  };
  const extended = [
    {
      action: 'email',
      method: 'PATCH',
      body: { email: 'new@example.test' },
      receipt: { updated: true },
      status: 200,
    },
    {
      action: 'password',
      method: 'PATCH',
      body: { password: 'new-password' },
      receipt: { updated: true },
      status: 200,
    },
    {
      action: 'unlink-providers',
      method: 'POST',
      body: { providersToUnlink: ['google.com'] },
      receipt: { updated: true },
      status: 201,
    },
    {
      action: 'generate-password-reset-link',
      method: 'POST',
      body: { email: 'user@example.test' },
      receipt: { link: 'https://auth.example.test/action?code=private' },
      status: 201,
    },
    {
      action: 'generate-email-verification-link',
      method: 'POST',
      body: { email: 'user@example.test' },
      receipt: { link: 'https://auth.example.test/action?code=private' },
      status: 201,
    },
    {
      action: '',
      method: 'DELETE',
      body: undefined,
      receipt: deletion,
      status: 202,
    },
    {
      action: 'identity',
      method: 'GET',
      body: undefined,
      receipt: identity,
      status: 200,
    },
    {
      action: 'deletion-status',
      method: 'GET',
      body: undefined,
      receipt: deletion,
      status: 200,
    },
  ];

  it.each(extended)(
    'maps $method $action and validates the owner receipt',
    async ({ action, method, body, receipt, status }) => {
      handler = (_request, response) => json(response, status, receipt);
      const response = await call(action, {
        method,
        headers: { ...trusted, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual(receipt);
      expect(observed).toHaveLength(1);
      expect(observed[0].method).toBe(method);
      expect(observed[0].path).toBe(
        `/api/admin/users/local%3ACase-Sensitive${action ? '/' + action : ''}`
      );
      expect(observed[0].body).toBe(body ? JSON.stringify(body) : '');
    }
  );

  it.each(extended)(
    'rejects scope selectors and forged context on $action',
    async ({ action, method, body }) => {
      const options = {
        method,
        headers: { ...trusted, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      };
      expect((await call(action + '?tenant=other', options)).status).toBe(400);
      expect(
        (
          await call(action, {
            ...options,
            headers: { ...options.headers, 'x-ingress-auth': 'forged' },
          })
        ).status
      ).toBe(401);
      expect(observed).toHaveLength(0);
    }
  );

  it.each([
    ['email', { email: 'invalid' }],
    ['email', { email: 'a@example.test', uid: 'other' }],
    ['password', { password: 'x'.repeat(129) }],
    ['password', { password: 'short' }],
    ['password', null],
    ['password', ['new-password']],
    ['unlink-providers', { providersToUnlink: [] }],
    ['unlink-providers', { providersToUnlink: ['google.com', 'google.com'] }],
    ['unlink-providers', { providersToUnlink: ['provider/other'] }],
    ['generate-password-reset-link', { email: 'invalid' }],
  ])('rejects invalid %s body before forwarding', async (action, body) => {
    expect(
      (
        await call(String(action), {
          method: ['email', 'password'].includes(String(action))
            ? 'PATCH'
            : 'POST',
          headers: { ...trusted, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each(['identity', 'deletion-status'])(
    'returns explicit JSON null for absent %s',
    async (action) => {
      handler = (_request, response) => json(response, 200, null);
      const response = await call(action, { method: 'GET' });
      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
    }
  );

  it.each(['pending', 'failed', 'completed'])(
    'preserves truthful cleanup %s on acceptance and status reads',
    async (cleanup) => {
      handler = (_request, response) =>
        json(response, 202, { ...deletion, cleanup });
      expect(await (await call('', { method: 'DELETE' })).json()).toEqual({
        ...deletion,
        cleanup,
      });
      handler = (_request, response) =>
        json(response, 200, { ...deletion, cleanup });
      expect(
        await (await call('deletion-status', { method: 'GET' })).json()
      ).toEqual({ ...deletion, cleanup });
    }
  );

  it.each([
    { ...deletion, identityId: target.toUpperCase() },
    { ...deletion, revision: 0 },
    { ...deletion, cleanup: 'done' },
    { ...deletion, status: 'completed' },
    { ...deletion, secret: 'private' },
    null,
  ])('rejects mismatched deletion receipts', async (receipt) => {
    handler = (_request, response) => json(response, 202, receipt);
    expect((await call('', { method: 'DELETE' })).status).toBe(503);
    expect(observed).toHaveLength(1);
  });

  it.each([
    'javascript:alert(1)',
    'http://auth.example.test',
    'https://user:secret@auth.example.test',
    'https://auth.example.test/has space',
  ])('rejects unsafe action links', async (link) => {
    handler = (_request, response) => json(response, 201, { link });
    expect(
      (
        await call('generate-password-reset-link', {
          headers: { ...trusted, 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'user@example.test' }),
        })
      ).status
    ).toBe(503);
  });

  it.each([
    ['disable', 'disabled'],
    ['enable', 'enabled'],
    ['revoke-tokens', 'revoked'],
  ])(
    'forwards %s with exact subject and filtered trusted context',
    async (action, field) => {
      handler = (_request, response) => json(response, 201, { [field]: true });
      const response = await call(action, {
        headers: {
          ...trusted,
          authorization: 'Bearer secret-token',
          cookie: 'private',
          'x-user-email': 'private@example.test',
          'x-account-export-worker': 'forged',
        },
      });
      expect(response.status).toBe(201);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual({ [field]: true });
      expect(observed).toHaveLength(1);
      expect(observed[0]).toMatchObject({
        path: `/api/admin/users/local%3ACase-Sensitive/${action}`,
        method: 'POST',
        body: '',
      });
      expect(observed[0].headers['x-user-id']).toBe('Operator');
      expect(JSON.parse(String(observed[0].headers['x-user-claims']))).toEqual({
        roles: ['identity:admin'],
        tenantId: 'Tenant',
      });
      for (const name of [
        'authorization',
        'cookie',
        'x-user-email',
        'x-account-export-worker',
      ])
        expect(observed[0].headers[name]).toBeUndefined();
    }
  );
  it.each([
    {},
    { ...trusted, 'x-ingress-auth': 'forged' },
    { ...trusted, 'x-anonymous': 'true' },
  ])('rejects untrusted identities', async (headers) => {
    expect((await call('disable', { headers })).status).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each([
    '../other',
    'user?tenant=other',
    'user#other',
    '%2fadmin',
    'user\\other',
    ' target ',
    'x'.repeat(129),
  ])('rejects unsafe target %s', async (uid) => {
    expect((await call('disable', {}, uid)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it('rejects scope selectors and unexpected command bodies', async () => {
    expect((await call('disable?tenantId=other')).status).toBe(400);
    expect(
      (
        await call('disable', {
          body: JSON.stringify({ uid: 'Other' }),
          headers: { ...trusted, 'content-type': 'application/json' },
        })
      ).status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([400, 401, 403, 404, 409, 429])(
    'preserves owner HTTP %i without leaking details',
    async (status) => {
      handler = (_request, response) =>
        json(response, status, { secret: 'internal-provider-details' });
      const response = await call();
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.text()).not.toContain('internal-provider-details');
      expect(observed).toHaveLength(1);
    }
  );
  it.each([
    {},
    { disabled: false },
    { disabled: 'true' },
    { enabled: true },
    { disabled: true, secret: 'leak' },
  ])('rejects a false or malformed receipt', async (receipt) => {
    handler = (_request, response) => json(response, 201, receipt);
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it.each([200, 202, 500, 503])(
    'does not fabricate success from status %i',
    async (status) => {
      handler = (_request, response) =>
        json(response, status, { disabled: true });
      expect((await call()).status).toBe(503);
      expect(observed).toHaveLength(1);
    }
  );
  it('does not follow redirects or retry a lost mutation response', async () => {
    handler = (_request, response) => {
      response.writeHead(307, { location: ownerOrigin + '/replayed' });
      response.end();
    };
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(1);
    observed.length = 0;
    handler = (_request, response) => response.destroy();
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it('bounds downstream responses and requires JSON', async () => {
    handler = (_request, response) =>
      json(response, 201, { disabled: true, huge: 'x'.repeat(20000) });
    expect((await call()).status).toBe(503);
    handler = (_request, response) => {
      response.writeHead(201, { 'content-type': 'text/plain' });
      response.end('{"disabled":true}');
    };
    expect((await call()).status).toBe(503);
  });
  it.each([
    undefined,
    'http://user:password@localhost',
    'file:///tmp',
    'http://localhost/path',
    'http://localhost/?query',
  ])('rejects invalid owner configuration', async (value) => {
    config['ACCOUNT_MANAGEMENT_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it('does not expose unimplemented administration actions', async () => {
    expect((await call('delete')).status).toBe(404);
    expect(observed).toHaveLength(0);
  });
});
