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
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import { AppModule } from '../app.module';

type Upstream = (
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown
) => void;
const secret = 'test-portal-preferences-ingress-secret';
const preferences = defaultAccountPreferences();
const snapshot = {
  identityId: 'Alice',
  revision: 4,
  updatedAt: null,
  preferences,
};
const update = { expectedRevision: 4, preferences };
const trusted = {
  'x-ingress-auth': secret,
  'x-user-id': 'Alice',
  'x-user-claims': JSON.stringify({
    tenantId: 'default',
    roles: ['member'],
    unrelated: 'private-claim',
  }),
};
const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

describe('portal preferences through BFF HTTP and Account HTTP', () => {
  let app: INestApplication,
    account: Server,
    origin: string,
    accountOrigin: string;
  let handler: Upstream;
  const observed: {
    path: string | undefined;
    method: string | undefined;
    headers: IncomingMessage['headers'];
    body: unknown;
  }[] = [];
  const config: Record<string, string | undefined> = {};

  beforeAll(async () => {
    account = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : undefined;
      observed.push({
        path: request.url,
        method: request.method,
        headers: request.headers,
        body,
      });
      handler(request, response, body);
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
    handler = (request, response) =>
      json(
        response,
        200,
        request.method === 'GET'
          ? snapshot
          : { identityId: 'Alice', revision: 5 }
      );
  });
  const call = (
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = trusted,
    query = ''
  ) =>
    fetch(origin + '/api/me/preferences' + query, {
      method,
      headers: {
        ...headers,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  it('reads through the actual HTTP adapter and forwards only verified account context', async () => {
    const response = await call('GET', undefined, {
      ...trusted,
      authorization: 'Bearer do-not-forward',
      cookie: 'session=private',
      'x-account-erasure': 'do-not-forward',
      'x-user-email': 'private@example.test',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(snapshot);
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      path: '/api/me/preferences',
      method: 'GET',
      headers: {
        'x-user-id': 'Alice',
        'x-ingress-auth': secret,
        'x-anonymous': 'false',
        'x-user-claims': JSON.stringify({
          tenantId: 'default',
          roles: ['member'],
        }),
      },
    });
    for (const header of [
      'authorization',
      'cookie',
      'x-account-erasure',
      'x-user-email',
    ])
      expect(observed[0].headers[header]).toBeUndefined();
  });

  it('preserves the update revision and idempotency key through both HTTP boundaries', async () => {
    const response = await call('PUT', update, {
      ...trusted,
      'idempotency-key': 'original-command-key',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ identityId: 'Alice', revision: 5 });
    expect(observed[0]).toMatchObject({
      method: 'PUT',
      body: update,
      headers: { 'idempotency-key': 'original-command-key' },
    });
    expect(observed).toHaveLength(1);
  });

  it.each<Record<string, string>>([
    {},
    { 'x-user-id': 'Alice' },
    { ...trusted, 'x-ingress-auth': 'forged' },
    { ...trusted, 'x-anonymous': 'true' },
    { ...trusted, 'x-user-id': '' },
  ])(
    'rejects untrusted or anonymous callers before Account I/O: %j',
    async (headers) => {
      const response = await call('GET', undefined, headers);
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(observed).toHaveLength(0);
    }
  );

  it.each(['not-json', '[]', '{"roles":[123]}', '{"tenantId":123}'])(
    'rejects malformed claims: %s',
    async (claims) => {
      expect(
        (await call('GET', undefined, { ...trusted, 'x-user-claims': claims }))
          .status
      ).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );

  it.each(['content-length', 'transfer-encoding'])(
    'rejects GET bodies before Account I/O: %s',
    async (framing) => {
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const request = httpRequest(
            origin + '/api/me/preferences',
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
        }
      );
      expect(status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );

  it('rejects duplicate trusted identity headers', async () => {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        origin + '/api/me/preferences',
        { headers: { ...trusted, 'x-user-id': ['Alice', 'Bob'] } },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode));
        }
      );
      request.on('error', reject);
      request.end();
    });
    expect(status).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each([
    { ...update, identityId: 'Bob' },
    { ...update, expectedRevision: '4' },
    { ...update, preferences: {} },
  ])('rejects malformed commands without forwarding them', async (body) => {
    expect(
      (await call('PUT', body, { ...trusted, 'idempotency-key': 'command' }))
        .status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it('rejects missing command keys and account-selection query parameters', async () => {
    expect((await call('PUT', update)).status).toBe(400);
    expect(
      (await call('GET', undefined, trusted, '?identityId=Bob')).status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it.each([400, 401, 403, 404, 409, 413, 429])(
    'preserves Account status %s without exposing upstream diagnostics',
    async (status) => {
      handler = (_request, response) =>
        json(response, status, { message: 'private database detail' });
      const response = await call('PUT', update, {
        ...trusted,
        'idempotency-key': 'command',
      });
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).not.toContain('private database detail');
      expect(observed).toHaveLength(1);
    }
  );

  it.each([
    { ...snapshot, identityId: 'Bob' },
    { ...snapshot, revision: '4' },
    { ...snapshot, privateData: 'unexpected' },
  ])('rejects malformed or cross-account snapshots', async (body) => {
    handler = (_request, response) => json(response, 200, body);
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('Bob');
  });

  it.each([
    { identityId: 'Bob', revision: 5 },
    { identityId: 'Alice', revision: 4 },
  ])('rejects invalid save receipts', async (receipt) => {
    handler = (_request, response) => json(response, 200, receipt);
    expect(
      (await call('PUT', update, { ...trusted, 'idempotency-key': 'command' }))
        .status
    ).toBe(503);
  });

  it('does not retry an uncertain PUT internally; the caller can retry the identical command', async () => {
    let committed = false;
    handler = (request, response) => {
      if (!committed) {
        committed = true;
        request.socket.destroy();
        return;
      }
      json(response, 200, { identityId: 'Alice', revision: 5 });
    };
    const headers = { ...trusted, 'idempotency-key': 'stable-command' };
    const uncertain = await call('PUT', update, headers);
    expect(uncertain.status).toBe(503);
    expect(uncertain.headers.get('retry-after')).toBe('2');
    expect(observed).toHaveLength(1);
    const retry = await call('PUT', update, headers);
    expect(retry.status).toBe(200);
    expect(observed).toHaveLength(2);
    expect(observed[1].body).toEqual(observed[0].body);
    expect(observed[1].headers['idempotency-key']).toBe(
      observed[0].headers['idempotency-key']
    );
  });

  it('rejects redirects without following them', async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: accountOrigin + '/private' });
      response.end();
    };
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(1);
  });

  it('rejects oversized and non-JSON responses', async () => {
    handler = (_request, response) =>
      json(response, 200, { payload: 'x'.repeat(65536) });
    expect((await call()).status).toBe(503);
    handler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(JSON.stringify(snapshot));
    };
    expect((await call()).status).toBe(503);
  });

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

  it('fails closed for missing trusted ingress configuration', async () => {
    config['INGRESS_AUTH_SECRET'] = undefined;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
});
