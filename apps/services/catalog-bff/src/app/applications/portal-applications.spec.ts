import { createHash } from 'node:crypto';
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

const id = '10000000-0000-4000-8000-000000000001',
  imageId = '10000000-0000-4000-8000-000000000002',
  appId = '10000000-0000-4000-8000-000000000003';
const drafts = '/api/me/application-drafts',
  images = '/api/me/application-images';
const fields = {
  name: 'Work tools',
  slug: 'work-tools',
  website: 'https://example.test',
  description: 'An application with enough detail.',
  classification: 'general',
};
const editing = {
  applicationId: appId,
  claimId: id,
  sourcePublicationRevision: 4,
};
const source = { ...editing, fields, images: { logo: null, banner: null } };
const draft = {
  ...fields,
  id,
  revision: 3,
  createdAt: 1,
  updatedAt: 2,
  images: source.images,
};
const sourceBytes = Buffer.from('source image');
const descriptor = {
  contentType: 'image/png',
  bytes: sourceBytes.length,
  sha256: createHash('sha256').update(sourceBytes).digest('hex'),
};
const reservation = { draftId: id, purpose: 'logo', source: descriptor };
const upload = {
  ...reservation,
  id: imageId,
  revision: 1,
  status: 'pending',
  createdAt: 1,
  expiresAt: 86400001,
  asset: null,
};
const webp = Buffer.from('524946460c000000574542505650384c00000000', 'hex');
const trusted = {
  'x-ingress-auth': 'application-bff-test',
  'x-user-id': 'Alice',
  'x-anonymous': 'false',
  'x-user-claims':
    '{"roles":["member"],"tenantId":"tenant-a","ignored":"private"}',
};
const anonymous = {
  'x-ingress-auth': trusted['x-ingress-auth'],
  'x-anonymous': 'true',
};
const publicPath = `/api/media/applications/${appId}/logo/${imageId}`;
const previews = [
  `${images}/${imageId}/content`,
  `${drafts}/${id}/images/logo/content`,
  `${drafts}/canonical/${appId}/images/banner/content`,
  `${drafts}/${id}/submissions/1/images/logo/content`,
  `/api/editorial/application-reviews/${id}/submissions/1/images/logo/content`,
  publicPath,
];
const json = (res: ServerResponse, body: unknown, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const binary = (
  res: ServerResponse,
  body = webp,
  headers: Record<string, string> = {}
) => {
  res.writeHead(200, {
    'content-type': 'image/webp',
    'content-length': String(body.length),
    ...headers,
  });
  res.end(body);
};
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

describe('application drafts and images through production BFF routes', () => {
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
    bytes: Buffer;
  }[] = [];
  beforeAll(async () => {
    upstream = createServer(async (req, res) => {
      const parts: Buffer[] = [];
      for await (const chunk of req) parts.push(Buffer.from(chunk));
      observed.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        bytes: Buffer.concat(parts),
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
    config['EDITORIAL_URL'] = upstreamOrigin;
    handler = (req, res) =>
      json(res, req.url?.startsWith(images) ? upload : draft);
  });
  const call = (
    path = drafts,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ) =>
    fetch(origin + path, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.headers ?? trusted),
        ...(options.body === undefined || Buffer.isBuffer(options.body)
          ? {}
          : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined
        ? {}
        : {
            body: Buffer.isBuffer(options.body)
              ? options.body
              : JSON.stringify(options.body),
          }),
    });
  const command = (
    path: string,
    body: unknown,
    method = 'POST',
    key = 'stable-key'
  ) =>
    call(path, {
      method,
      body,
      headers: { ...trusted, 'idempotency-key': key },
    });
  const putImage = (body = sourceBytes, headers: Record<string, string> = {}) =>
    call(`${images}/${imageId}/content`, {
      method: 'PUT',
      body,
      headers: {
        ...trusted,
        'content-type': 'application/octet-stream',
        'if-match': '"1"',
        'idempotency-key': 'binary-key',
        ...headers,
      },
    });
  const waitForObserved = async (count: number) => {
    const end = Date.now() + 3000;
    while (observed.length < count && Date.now() < end)
      await new Promise((resolve) => setTimeout(resolve, 5));
    expect(observed).toHaveLength(count);
  };

  it.each([
    [drafts, [draft]],
    [`${drafts}/${id}`, draft],
    [`${drafts}/canonical/${appId}`, source],
    [images + '?draftId=' + id, [upload]],
    [`${images}/${imageId}`, upload],
  ])('reads %s with strict owning-service contracts', async (path, value) => {
    handler = (_req, res) => json(res, value);
    const response = await call(String(path));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(value);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(observed).toHaveLength(1);
    expect(observed[0].url).toBe(path);
  });
  it.each([
    [drafts, fields, 'POST', { id, revision: 1, deleted: false }],
    [
      `${drafts}/${id}`,
      { ...fields, expectedRevision: 3 },
      'PUT',
      { id, revision: 4, deleted: false },
    ],
    [
      `${drafts}/${id}`,
      { expectedRevision: 3 },
      'DELETE',
      { id, revision: 4, deleted: true },
    ],
    [
      drafts + '/from-application',
      { editing, fields },
      'POST',
      { id, revision: 1, deleted: false },
    ],
    [
      `${drafts}/${id}/rebase`,
      {
        editing,
        fields,
        expectedRevision: 3,
        imageChoices: { logo: 'draft', banner: 'canonical' },
      },
      'POST',
      { id, revision: 4, deleted: false },
    ],
    [
      `${drafts}/${id}/images`,
      { expectedRevision: 3, purpose: 'logo', imageId },
      'PUT',
      { id, revision: 4, deleted: false },
    ],
    [
      `${drafts}/${id}/images`,
      { expectedRevision: 3, purpose: 'banner', imageId: null },
      'PUT',
      { id, revision: 4, deleted: false },
    ],
    [
      images,
      reservation,
      'POST',
      { id: imageId, revision: 1, status: 'pending' },
    ],
    [
      `${images}/${imageId}`,
      { expectedRevision: 2 },
      'DELETE',
      { id: imageId, revision: 3, status: 'cancelled' },
    ],
  ])(
    'preserves %s %s command and receipt',
    async (path, body, method, result) => {
      handler = (_req, res) => json(res, result, method === 'POST' ? 201 : 200);
      const response = await command(String(path), body, String(method));
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(await response.json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(observed[0].url).toBe(path);
      expect(observed[0].method).toBe(method);
      expect(JSON.parse(observed[0].bytes.toString())).toEqual(body);
      expect(observed[0].headers['idempotency-key']).toBe('stable-key');
    }
  );
  it('normalizes fields without inventing classification or image merge choices', async () => {
    handler = (_req, res) =>
      json(res, { id, revision: 1, deleted: false }, 201);
    const legacy: Partial<typeof fields> = { ...fields };
    delete legacy.classification;
    expect(
      (
        await command(drafts + '/from-application', {
          editing,
          fields: { ...legacy, name: ' Work tools ' },
        })
      ).status
    ).toBe(201);
    expect(JSON.parse(observed[0].bytes.toString())).toEqual({
      editing,
      fields: legacy,
    });
  });
  it.each(previews)(
    'returns bounded WebP bytes for %s without ambient response headers',
    async (path) => {
      handler = (_req, res) =>
        binary(res, webp, {
          'set-cookie': 'secret=yes',
          location: 'https://private.test',
          'x-internal-secret': 'private',
        });
      const response = await call(path);
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(webp);
      expect(response.headers.get('content-type')).toBe('image/webp');
      expect(response.headers.get('content-length')).toBe(String(webp.length));
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('content-security-policy')).toContain(
        'sandbox'
      );
      for (const key of ['set-cookie', 'location', 'x-internal-secret'])
        expect(response.headers.get(key)).toBeNull();
      expect(observed[0].url).toBe(path);
      expect(observed).toHaveLength(1);
    }
  );
  it('accepts verified anonymous public image access, but denies it for all private endpoints', async () => {
    handler = (_req, res) => binary(res);
    expect((await call(publicPath, { headers: anonymous })).status).toBe(200);
    expect(observed[0].headers['x-anonymous']).toBe('true');
    expect(observed[0].headers['x-user-id']).toBeUndefined();
    for (const path of [
      drafts,
      `${drafts}/${id}`,
      `${drafts}/canonical/${appId}`,
      images + '?draftId=' + id,
      ...previews.slice(0, -1),
    ])
      expect((await call(path, { headers: anonymous })).status).toBe(401);
    expect((await call(publicPath, { headers: {} })).status).toBe(401);
    expect(
      (
        await call(publicPath, {
          headers: { ...anonymous, authorization: 'Bearer invalid' },
        })
      ).status
    ).toBe(401);
    expect(observed).toHaveLength(1);
  });
  it('forwards only canonical identity and tenant/roles, never bearer, cookie or internal credentials', async () => {
    await call(`${drafts}/${id}`, {
      headers: {
        ...trusted,
        authorization: 'Bearer private',
        cookie: 'secret',
        'x-user-email': 'private@example.test',
        'x-auth-time': '123',
        'x-editorial-internal-auth': 'private',
      },
    });
    expect(observed[0].headers['x-user-id']).toBe('Alice');
    expect(JSON.parse(String(observed[0].headers['x-user-claims']))).toEqual({
      roles: ['member'],
      tenantId: 'tenant-a',
    });
    for (const key of [
      'authorization',
      'cookie',
      'x-user-email',
      'x-auth-time',
      'x-editorial-internal-auth',
    ])
      expect(observed[0].headers[key]).toBeUndefined();
  });
  it.each([
    { ...trusted, 'x-ingress-auth': 'forged' },
    { ...trusted, 'x-user-id': '' },
    { ...trusted, 'x-user-claims': '{broken' },
    { ...trusted, 'x-user-claims': '{"tenantId":123}' },
  ])('rejects invalid trusted context %j', async (headers) => {
    expect([400, 401]).toContain((await call(drafts, { headers })).status);
    expect(observed).toHaveLength(0);
  });
  it.each([
    drafts + '?owner=other',
    drafts + '/invalid',
    `${drafts}/${id}?revision=1`,
    drafts + '/canonical/invalid',
    images,
    images + '?draftId=invalid',
    images + `?draftId=${id}&draftId=${imageId}`,
    images + `?draftId=${id}&owner=other`,
    images + '/invalid',
    `${images}/${imageId}?tenantId=other`,
    `${drafts}/${id}/images/thumbnail/content`,
    `${drafts}/${id}/images/logo/content?revision=2`,
    `${drafts}/${id}/submissions/0/images/logo/content`,
    `${drafts}/${id}/submissions/9007199254740992/images/logo/content`,
    `/api/media/applications/${appId}/logo/invalid`,
    publicPath + '?private=true',
  ])('rejects invalid selectors %s', async (path) => {
    expect((await call(path)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    [drafts, { ...fields, ownerIdentityId: 'other' }, 'POST'],
    [drafts, { ...fields, name: 'x' }, 'POST'],
    [drafts, { ...fields, slug: 'Bad Slug' }, 'POST'],
    [
      drafts,
      { ...fields, website: 'https://user:secret@example.test' },
      'POST',
    ],
    [drafts, { ...fields, classification: 'unknown' }, 'POST'],
    [`${drafts}/${id}`, { ...fields, expectedRevision: 0 }, 'PUT'],
    [`${drafts}/${id}`, { expectedRevision: 3, name: 'extra' }, 'DELETE'],
    [
      drafts + '/from-application',
      { editing: { ...editing, claimId: 'invalid' }, fields },
      'POST',
    ],
    [
      drafts + '/from-application',
      { editing, fields, expectedRevision: 1 },
      'POST',
    ],
    [
      `${drafts}/${id}/rebase`,
      {
        editing,
        fields,
        expectedRevision: 3,
        imageChoices: { logo: 'invented', banner: 'draft' },
      },
      'POST',
    ],
    [
      `${drafts}/${id}/images`,
      { expectedRevision: 3, purpose: 'logo', imageId: 'invalid' },
      'PUT',
    ],
    [
      `${drafts}/${id}/images`,
      { expectedRevision: 3, purpose: 'logo', imageId, asset: {} },
      'PUT',
    ],
    [
      images,
      { ...reservation, source: { ...descriptor, bytes: 8388609 } },
      'POST',
    ],
    [
      images,
      { ...reservation, source: { ...descriptor, sha256: 'invalid' } },
      'POST',
    ],
    [
      images,
      {
        ...reservation,
        source: { ...descriptor, contentType: 'image/svg+xml' },
      },
      'POST',
    ],
    [`${images}/${imageId}`, { expectedRevision: 1, draftId: id }, 'DELETE'],
  ])('rejects malformed command %s %j', async (path, body, method) => {
    expect((await command(String(path), body, String(method))).status).toBe(
      400
    );
    expect(observed).toHaveLength(0);
  });
  it.each(['', 'bad key', 'x'.repeat(129)])(
    'rejects invalid idempotency key %s',
    async (key) => {
      expect((await command(drafts, fields, 'POST', key)).status).toBe(400);
      expect(observed).toHaveLength(0);
    }
  );
  it('authorizes before buffering upload bytes, preserving exact source, key and If-Match', async () => {
    const result = { id: imageId, revision: 2, status: 'ready' };
    handler = (req, res) => json(res, req.method === 'GET' ? upload : result);
    const response = await putImage();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(observed.map((r) => r.method)).toEqual(['GET', 'PUT']);
    expect(observed[1].bytes).toEqual(sourceBytes);
    expect(observed[1].headers['if-match']).toBe('"1"');
    expect(observed[1].headers['idempotency-key']).toBe('binary-key');
    expect(observed[1].headers['content-type']).toBe(
      'application/octet-stream'
    );
  });
  it('lets Editorial replay a ready receipt after cancellation without a BFF lifecycle override', async () => {
    handler = (req, res) =>
      json(
        res,
        req.method === 'GET'
          ? { ...upload, revision: 3, status: 'cancelled' }
          : { id: imageId, revision: 2, status: 'ready' }
      );
    expect((await putImage()).status).toBe(200);
    expect(observed.map((r) => r.method)).toEqual(['GET', 'PUT']);
  });
  it('never sends bytes when owning-service authorization fails', async () => {
    handler = (_req, res) => json(res, { private: true }, 404);
    expect((await putImage()).status).toBe(404);
    expect(observed).toHaveLength(1);
    expect(observed[0].method).toBe('GET');
  });
  it.each([
    [{ 'content-type': 'image/png' }, 415],
    [{ 'content-encoding': 'gzip' }, 415],
    [{ 'if-match': '1' }, 400],
    [{ 'if-match': '"9007199254740992"' }, 400],
    [{ 'idempotency-key': '' }, 400],
  ] as const)('rejects invalid upload headers %j', async (headers, code) => {
    expect((await putImage(sourceBytes, headers)).status).toBe(code);
    expect(observed).toHaveLength(0);
  });
  it('rejects mismatching source length/hash before any write', async () => {
    expect((await putImage(Buffer.from('different'))).status).toBe(400);
    expect((await putImage(Buffer.alloc(sourceBytes.length))).status).toBe(400);
    expect(observed.map((r) => r.method)).toEqual(['GET', 'GET']);
  });
  it('rejects duplicate headers, GET bodies and oversized upload declarations', async () => {
    const raw = (
      method: string,
      path: string,
      headers: Record<string, string | string[]>,
      body = Buffer.alloc(0)
    ) =>
      new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          origin + path,
          { method, headers: { ...trusted, ...headers } },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode ?? 0));
          }
        );
        req.on('error', reject);
        req.end(body);
      });
    expect(
      await raw(
        'POST',
        drafts,
        {
          'idempotency-key': ['one', 'two'],
          'content-type': 'application/json',
        },
        Buffer.from(JSON.stringify(fields))
      )
    ).toBe(400);
    expect(
      await raw(
        'GET',
        drafts,
        { 'content-type': 'application/json', 'content-length': '2' },
        Buffer.from('{}')
      )
    ).toBe(400);
    expect(
      await raw('PUT', `${images}/${imageId}/content`, {
        'content-type': 'application/octet-stream',
        'if-match': '"1"',
        'idempotency-key': 'key',
        'content-length': '8388609',
      })
    ).toBe(413);
    expect(observed).toHaveLength(0);
  });
  it('bounds concurrent uploads before authorization and releases permits after denial', async () => {
    const pending: ServerResponse[] = [];
    handler = (_req, res) => {
      pending.push(res);
    };
    const first = putImage(),
      second = putImage();
    await waitForObserved(2);
    expect((await putImage()).status).toBe(503);
    expect(observed).toHaveLength(2);
    pending.forEach((res) => json(res, {}, 403));
    expect((await first).status).toBe(403);
    expect((await second).status).toBe(403);
    handler = (req, res) =>
      json(
        res,
        req.method === 'GET'
          ? upload
          : { id: imageId, revision: 2, status: 'ready' }
      );
    expect((await putImage()).status).toBe(200);
  });
  it('bounds concurrent preview buffers and releases permits after completion', async () => {
    const pending: ServerResponse[] = [];
    handler = (_req, res) => {
      pending.push(res);
    };
    const requests = Array.from({ length: 4 }, () => call(previews[0]));
    await waitForObserved(4);
    expect((await call(previews[0])).status).toBe(503);
    expect(observed).toHaveLength(4);
    pending.forEach((res) => binary(res));
    for (const response of await Promise.all(requests))
      expect((await response.arrayBuffer()).byteLength).toBe(webp.length);
    handler = (_req, res) => binary(res);
    expect((await call(previews[0])).status).toBe(200);
  });
  it('bounds chunked upload bodies without forwarding oversized bytes', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        origin + `${images}/${imageId}/content`,
        {
          method: 'PUT',
          agent: false,
          headers: {
            ...trusted,
            'content-type': 'application/octet-stream',
            'transfer-encoding': 'chunked',
            'if-match': '"1"',
            'idempotency-key': 'chunked-upload',
          },
        },
        (res) => {
          res.resume();
          res.once('end', () => resolve(res.statusCode ?? 0));
        }
      );
      req.once('error', reject);
      req.end(Buffer.alloc(8 * 1024 * 1024 + 1));
    });
    expect(status).toBe(413);
    expect(observed.map((r) => r.method)).toEqual(['GET']);
  });
  it('releases upload capacity after interrupted bodies without forwarding bytes', async () => {
    const pending = Array.from({ length: 2 }, () => {
      const req = httpRequest(origin + `${images}/${imageId}/content`, {
        method: 'PUT',
        agent: false,
        headers: {
          ...trusted,
          'content-type': 'application/octet-stream',
          'content-length': String(sourceBytes.length),
          'if-match': '"1"',
          'idempotency-key': 'interrupted-upload',
        },
      });
      req.on('error', () => undefined);
      req.write(sourceBytes.subarray(0, 1));
      return req;
    });
    try {
      await waitForObserved(2);
      expect((await putImage()).status).toBe(503);
      expect(observed.map((r) => r.method)).toEqual(['GET', 'GET']);
    } finally {
      pending.forEach((req) => req.destroy());
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    handler = (req, res) =>
      json(
        res,
        req.method === 'GET'
          ? upload
          : {
              id: imageId,
              revision: 2,
              status: 'ready',
            }
      );
    const results = await Promise.all([putImage(), putImage()]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
  });
  it('cancels downstream preview I/O on browser disconnect and releases its permit', async () => {
    handler = () => undefined;
    const req = httpRequest(origin + previews[0], {
      headers: trusted,
      agent: false,
    });
    req.on('error', () => undefined);
    req.end();
    try {
      await waitForObserved(1);
    } finally {
      req.destroy();
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    handler = (_req, res) => binary(res);
    expect((await call(previews[0])).status).toBe(200);
  });
  it('does not retry a lost upload reply; explicit replay retains original bytes and key', async () => {
    handler = (req, res) =>
      req.method === 'GET' ? json(res, upload) : res.destroy();
    expect((await putImage()).status).toBe(503);
    expect(observed).toHaveLength(2);
    handler = (req, res) =>
      json(
        res,
        req.method === 'GET'
          ? upload
          : { id: imageId, revision: 2, status: 'ready' }
      );
    expect((await putImage()).status).toBe(200);
    expect(observed).toHaveLength(4);
    expect(observed[3].bytes).toEqual(observed[1].bytes);
    expect(observed[3].headers['idempotency-key']).toBe(
      observed[1].headers['idempotency-key']
    );
  });
  it.each([400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 502, 503])(
    'maps owner error %s without exposing internal data',
    async (status) => {
      handler = (_req, res) =>
        json(res, { message: 'SQL private secret' }, status);
      for (const path of [`${drafts}/${id}`, previews[0]]) {
        const response = await call(path);
        expect(response.status).toBe(status >= 500 ? 503 : status);
        expect(await response.text()).not.toContain('SQL private secret');
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        if (status >= 500 || status === 429)
          expect(response.headers.get('retry-after')).toBe('2');
      }
      expect(observed).toHaveLength(2);
    }
  );
  it.each([
    [drafts, [draft, draft]],
    [drafts, [{ ...draft, ownerIdentityId: 'private' }]],
    [`${drafts}/${id}`, { ...draft, id: appId }],
    [`${drafts}/canonical/${appId}`, { ...source, applicationId: id }],
    [images + '?draftId=' + id, [upload, upload]],
    [images + '?draftId=' + id, [{ ...upload, draftId: appId }]],
    [images + '?draftId=' + id, [{ ...upload, status: 'cancelled' }]],
    [`${images}/${imageId}`, { ...upload, id: appId }],
    [`${images}/${imageId}`, { ...upload, expiresAt: 10 }],
    [`${images}/${imageId}`, { ...upload, status: 'ready' }],
  ])('rejects mismatched response for %s', async (path, value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(String(path))).status).toBe(503);
  });
  it.each([
    { id, revision: 3, deleted: false },
    { id: appId, revision: 4, deleted: false },
    { id, revision: 4, deleted: true },
    { id, revision: 4, deleted: false, owner: 'private' },
  ])('rejects invalid draft receipt %j', async (result) => {
    handler = (_req, res) => json(res, result);
    expect(
      (
        await command(
          `${drafts}/${id}`,
          { ...fields, expectedRevision: 3 },
          'PUT'
        )
      ).status
    ).toBe(503);
  });
  it.each([
    { id: imageId, revision: 1, status: 'ready' },
    { id: imageId, revision: 2, status: 'pending' },
    { id, revision: 2, status: 'ready' },
  ])('rejects invalid upload receipt %j', async (result) => {
    handler = (req, res) => json(res, req.method === 'GET' ? upload : result);
    expect((await putImage()).status).toBe(503);
  });
  it.each([
    undefined,
    'file:///tmp/private',
    'https://user:secret@example.test',
    'http://localhost/prefix',
    'http://localhost?secret=private',
  ])('fails closed on invalid Editorial origin %s', async (value) => {
    config['EDITORIAL_URL'] = value;
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(0);
  });
  it.each([
    drafts + '/' + id + '/unknown',
    images + '/' + imageId + '/unknown',
    publicPath + '/unknown',
  ])('does not proxy unknown path %s', async (path) => {
    expect((await call(path)).status).toBe(404);
    expect(observed).toHaveLength(0);
  });
  it('bounds JSON responses and rejects wrong status, media and redirects', async () => {
    handler = (_req, res) => json(res, 'x'.repeat(2 * 1024 * 1024));
    expect((await call()).status).toBe(503);
    handler = (_req, res) => {
      res.writeHead(302, { location: upstreamOrigin + '/internal' });
      res.end();
    };
    expect((await call()).status).toBe(503);
    handler = (_req, res) =>
      json(res, { id, revision: 1, deleted: false }, 200);
    expect((await command(drafts, fields)).status).toBe(503);
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('[]');
    };
    expect((await call()).status).toBe(503);
    expect(observed).toHaveLength(4);
  });
  it.each([
    [Buffer.from('not an image'), {}],
    [webp, { 'content-type': 'text/html' }],
    [webp, { 'content-encoding': 'gzip' }],
    [Buffer.from('524946460d000000574542505650384c00000000', 'hex'), {}],
    [Buffer.alloc(8388609), {}],
  ] as const)(
    'rejects malformed or oversized preview bytes',
    async (bytes, headers) => {
      handler = (_req, res) => binary(res, bytes, headers);
      expect((await call(previews[0])).status).toBe(503);
    }
  );
  it('rejects missing and truncated binary lengths', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'image/webp' });
      res.write(webp);
      res.end();
    };
    expect((await call(previews[0])).status).toBe(503);
    handler = (_req, res) => {
      res.writeHead(200, {
        'content-type': 'image/webp',
        'content-length': String(webp.length + 1),
      });
      res.end(webp);
      res.socket?.destroy();
    };
    expect((await call(previews[0])).status).toBe(503);
  });
  it('enforces total JSON/preview deadlines without retries', async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => timeout(30));
    handler = () => undefined;
    try {
      expect((await call()).status).toBe(503);
      expect((await call(previews[0])).status).toBe(503);
      expect(spy).toHaveBeenCalledWith(15000);
      expect(observed).toHaveLength(2);
    } finally {
      spy.mockRestore();
    }
  });
  it('enforces the upload deadline without retrying a possibly committed command', async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => timeout(30));
    handler = (req, res) => {
      if (req.method === 'GET') json(res, upload);
    };
    try {
      expect((await putImage()).status).toBe(503);
      expect(spy).toHaveBeenCalledWith(30000);
      expect(observed.map((r) => r.method)).toEqual(['GET', 'PUT']);
    } finally {
      spy.mockRestore();
    }
  });
});
