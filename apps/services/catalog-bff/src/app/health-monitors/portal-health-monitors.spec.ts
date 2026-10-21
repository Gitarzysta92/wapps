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
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { configureHealthMonitorBody } from './portal-health-monitors.body';

const applicationId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const secret = 'health-monitor-test-ingress';
const trusted = {
  'x-ingress-auth': secret,
  'x-user-id': 'HealthStaff',
  'x-user-claims': JSON.stringify({
    roles: ['editorial:health-manager'],
    tenantId: 'default',
    private: 'discard',
  }),
};
const fields = {
  expectedRevision: 0,
  expectedApplicationRevision: 1,
  name: 'Website',
  url: 'https://health.example.test/',
  enabled: true,
};
const monitor = {
  id,
  applicationId,
  revision: 1,
  name: fields.name,
  url: fields.url,
  enabled: true,
};
const configuration = {
  applicationRevision: 1,
  website: 'https://health.example.test/',
  monitors: [monitor],
};

describe('health monitor BFF HTTP boundary', () => {
  let app: INestApplication, owner: Server, origin: string, ownerOrigin: string;
  let handler: (request: IncomingMessage, response: ServerResponse) => void;
  const config: Record<string, string | undefined> = {};
  const observed: {
    method?: string;
    path?: string;
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
        method: request.method,
        path: request.url,
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
    configureHealthMonitorBody(app);
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
    config['EDITORIAL_URL'] = ownerOrigin;
    handler = (request, response) =>
      json(response, 200, request.method === 'PUT' ? monitor : configuration);
  });
  const call = (
    method = 'GET',
    body: unknown = undefined,
    suffix = '',
    headers = trusted
  ) =>
    fetch(`${origin}/api/editorial/health-monitors/${applicationId}${suffix}`, {
      method,
      headers: { ...headers, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  it.each(['GET', 'PUT'])(
    'maps %s through a bounded owner contract with only trusted context',
    async (method) => {
      const response = await call(
        method,
        method === 'PUT'
          ? { ...fields, name: ' Website ', url: 'https://HEALTH.example.test' }
          : undefined,
        method === 'PUT' ? '/' + id : '',
        {
          ...trusted,
          ...{
            authorization: 'Bearer private',
            cookie: 'session=private',
            'x-user-email': 'private@example.test',
            'x-health-worker': 'forged',
            'x-tenant-id': 'other',
          },
        }
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual(
        method === 'PUT' ? monitor : configuration
      );
      expect(observed).toHaveLength(1);
      expect(observed[0]).toMatchObject({
        method,
        path: `/api/editorial/health-monitors/${applicationId}${
          method === 'PUT' ? '/' + id : ''
        }`,
        body: method === 'PUT' ? JSON.stringify(fields) : '',
      });
      expect(JSON.parse(String(observed[0].headers['x-user-claims']))).toEqual({
        tenantId: 'default',
        roles: ['editorial:health-manager'],
      });
      expect(observed[0].headers['x-user-id']).toBe('HealthStaff');
      expect(observed[0].headers['x-ingress-auth']).toBe(secret);
      expect(observed[0].headers['x-anonymous']).toBe('false');
      for (const key of [
        'authorization',
        'cookie',
        'x-user-email',
        'x-health-worker',
        'x-tenant-id',
      ])
        expect(observed[0].headers[key]).toBeUndefined();
    }
  );

  it('keeps disabled and historical-origin monitors editable', async () => {
    const old = {
      ...configuration,
      website: 'https://new.example.test/?approved=1',
      monitors: [{ ...monitor, enabled: false }],
    };
    handler = (_request, response) => json(response, 200, old);
    expect(await (await call()).json()).toEqual(old);
    handler = (_request, response) =>
      json(response, 200, { ...monitor, enabled: false, revision: 2 });
    expect(
      await (
        await call(
          'PUT',
          { ...fields, enabled: false, expectedRevision: 1 },
          '/' + id
        )
      ).json()
    ).toEqual({ ...monitor, enabled: false, revision: 2 });
  });

  it.each([
    {},
    { ...trusted, 'x-ingress-auth': 'forged' },
    { ...trusted, 'x-anonymous': 'true' },
    { ...trusted, 'x-user-id': '' },
  ])('rejects untrusted or anonymous context', async (headers) => {
    const response = await call(
      'GET',
      undefined,
      '',
      headers as typeof trusted
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(observed).toHaveLength(0);
  });

  it.each(['?tenantId=other', '?expectedRevision=0', '?unknown=1'])(
    'rejects selectors %s for reads and writes',
    async (query) => {
      expect((await call('GET', undefined, query)).status).toBe(400);
      expect((await call('PUT', fields, '/' + id + query)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it.each([
    'invalid',
    applicationId.toUpperCase().replace('1', 'A'),
    '%2Fescape',
    id + '%3Ftenant',
  ])('rejects malformed resource IDs %s', async (value) => {
    expect(
      (
        await fetch(`${origin}/api/editorial/health-monitors/${value}`, {
          headers: trusted,
        })
      ).status
    ).toBe(400);
    expect((await call('PUT', fields, '/' + value)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    null,
    [],
    {},
    { ...fields, expectedRevision: undefined },
    { ...fields, expectedApplicationRevision: 0 },
    { ...fields, expectedRevision: -1 },
    { ...fields, expectedRevision: 1.5 },
    { ...fields, expectedRevision: Number.MAX_SAFE_INTEGER },
    { ...fields, expectedRevision: '0' },
    { ...fields, tenantId: 'other' },
    { ...fields, enabled: 'true' },
    { ...fields, name: ' ' },
    { ...fields, name: 'x'.repeat(81) },
    { ...fields, name: 'line\nbreak' },
    ...[
      'http://127.0.0.1/',
      'https://user:password@health.example.test/',
      'https://health.example.test:8443/',
      'https://health.example.test/?token=private',
      'https://health.example.test/#fragment',
      'https://health.example.test/' + '\u00e9'.repeat(2000),
    ].map((url) => ({ ...fields, url })),
  ])('rejects invalid commands before forwarding', async (body) => {
    expect((await call('PUT', body, '/' + id)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });

  it('rejects read bodies and duplicate provenance headers', async () => {
    const raw = (headers: Record<string, string | string[]>, body?: string) =>
      new Promise<number | undefined>((resolve, reject) => {
        const request = httpRequest(
          `${origin}/api/editorial/health-monitors/${applicationId}`,
          { method: 'GET', headers },
          (response) => {
            response.resume();
            response.on('end', () => resolve(response.statusCode));
          }
        );
        request.on('error', reject);
        request.end(body);
      });
    expect(
      await raw(
        {
          ...trusted,
          'content-length': '2',
          'content-type': 'application/json',
        },
        '{}'
      )
    ).toBe(400);
    expect(await raw({ ...trusted, 'x-ingress-auth': [secret, secret] })).toBe(
      400
    );
    expect(observed).toHaveLength(0);
  });

  it.each([
    null,
    {},
    { ...configuration, applicationRevision: 0 },
    { ...configuration, website: 'javascript:bad' },
    { ...configuration, private: 'discard' },
    { ...configuration, monitors: [monitor, monitor] },
    { ...configuration, monitors: [{ ...monitor, applicationId: other }] },
    { ...configuration, monitors: [{ ...monitor, secret: 'discard' }] },
    { ...configuration, monitors: [{ ...monitor, url: 'http://127.0.0.1/' }] },
    {
      ...configuration,
      monitors: [
        {
          ...monitor,
          url: 'https://health.example.test/' + '\u00e9'.repeat(2000),
        },
      ],
    },
    {
      ...configuration,
      monitors: Array.from({ length: 9 }, (_, i) => ({
        ...monitor,
        id: `${i}` + id.slice(1),
      })),
    },
  ])(
    'rejects malformed, excessive or cross-application configuration responses',
    async (receipt) => {
      handler = (_request, response) => json(response, 200, receipt);
      expect((await call()).status).toBe(503);
      expect(observed).toHaveLength(1);
    }
  );
  it.each([
    { monitors: [] },
    {
      monitors: Array.from({ length: 8 }, (_, i) => ({
        ...monitor,
        id: `${i}` + id.slice(1),
      })),
    },
  ])(
    'accepts bounded empty and maximum-size configuration lists',
    async ({ monitors }) => {
      handler = (_request, response) =>
        json(response, 200, { ...configuration, monitors });
      expect((await call()).status).toBe(200);
    }
  );

  it.each([
    null,
    {},
    { ...monitor, id: other },
    { ...monitor, applicationId: other },
    { ...monitor, revision: 2 },
    { ...monitor, enabled: false },
    { ...monitor, name: 'Other' },
    { ...monitor, url: 'https://other.example.test/' },
    { ...monitor, private: 'discard' },
  ])(
    'rejects command receipts that do not confirm the requested configuration',
    async (receipt) => {
      handler = (_request, response) => json(response, 200, receipt);
      expect((await call('PUT', fields, '/' + id)).status).toBe(503);
      expect(observed).toHaveLength(1);
    }
  );
  it.each([400, 401, 403, 404, 409, 429])(
    'preserves owner denial/conflict %i without leaking detail',
    async (status) => {
      handler = (_request, response) =>
        json(response, status, { internal: 'database-private-details' });
      for (const method of ['GET', 'PUT']) {
        const response = await call(
          method,
          method === 'PUT' ? fields : undefined,
          method === 'PUT' ? '/' + id : ''
        );
        expect(response.status).toBe(status);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(await response.text()).not.toContain('database-private-details');
      }
      expect(observed).toHaveLength(2);
    }
  );
  it.each([201, 202, 204, 500, 503])(
    'does not treat status %i as a confirmed configuration',
    async (status) => {
      handler = (_request, response) => json(response, status, monitor);
      expect((await call('PUT', fields, '/' + id)).status).toBe(503);
    }
  );
  it('does not redirect or automatically retry a lost write response', async () => {
    handler = (_request, response) => {
      response.writeHead(307, { location: ownerOrigin + '/replay' });
      response.end();
    };
    expect((await call('PUT', fields, '/' + id)).status).toBe(503);
    expect(observed).toHaveLength(1);
    observed.length = 0;
    handler = (_request, response) => response.destroy();
    expect((await call('PUT', fields, '/' + id)).status).toBe(503);
    expect(observed).toHaveLength(1);
  });
  it('requires bounded valid JSON responses', async () => {
    for (const [contentType, body] of [
      ['text/plain', JSON.stringify(configuration)],
      ['application/json', '{invalid'],
      [
        'application/json',
        JSON.stringify({ ...configuration, extra: 'x'.repeat(32768) }),
      ],
    ]) {
      handler = (_request, response) => {
        response.writeHead(200, { 'content-type': contentType });
        response.end(body);
      };
      expect((await call()).status).toBe(503);
    }
  });
  it.each([
    undefined,
    'http://user:secret@localhost',
    'file:///tmp',
    'http://localhost/path',
    'http://localhost/?query',
    'http://localhost/#fragment',
  ])('fails closed with invalid owner configuration', async (value) => {
    config['EDITORIAL_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it('has no unbounded proxy or delete operation', async () => {
    expect((await call('DELETE', undefined, '/' + id)).status).toBe(404);
    expect((await call('POST', fields, '/' + id)).status).toBe(404);
    expect((await call('GET', undefined, '/' + id + '/internal')).status).toBe(
      404
    );
    expect(observed).toHaveLength(0);
  });

  it.each([
    { body: '{private-invalid-json', encoding: undefined, status: 400 },
    {
      body: JSON.stringify({ ...fields, extra: 'x'.repeat(8192) }),
      encoding: undefined,
      status: 413,
    },
    { body: JSON.stringify(fields), encoding: 'gzip', status: 415 },
  ])(
    'bounds and sanitizes body-parser failures',
    async ({ body, encoding, status }) => {
      const response = await fetch(
        `${origin}/api/editorial/health-monitors/${applicationId}/${id}`,
        {
          method: 'PUT',
          headers: {
            ...trusted,
            'content-type': 'application/json',
            ...(encoding ? { 'content-encoding': encoding } : {}),
          },
          body,
        }
      );
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual({
        statusCode: status,
        message: 'Invalid health monitor request body',
      });
      expect(observed).toHaveLength(0);
    }
  );

  it('bounds a silent owner with a real deadline and no mutation retry', async () => {
    handler = () => undefined;
    const started = Date.now();
    const response = await call('PUT', fields, '/' + id);
    expect(response.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(14000);
    expect(observed).toHaveLength(1);
  }, 15000);
});
