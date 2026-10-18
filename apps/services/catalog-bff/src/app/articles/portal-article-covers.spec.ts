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
  other = '10000000-0000-4000-8000-000000000003';
const drafts = '/api/me/articles',
  images = '/api/me/article-covers';
const sourceBytes = Buffer.from('source image');
const descriptor = {
  contentType: 'image/png',
  bytes: sourceBytes.length,
  sha256: createHash('sha256').update(sourceBytes).digest('hex'),
};
const reservation = { articleId: id, source: descriptor };
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
const publicPath = `/api/media/articles/${id}/${imageId}`;
const previews = [
  `${images}/${imageId}/content`,
  `${drafts}/${id}/submissions/1/cover`,
  `/api/editorial/article-reviews/${id}/submissions/1/cover`,
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

describe('article cover media through production BFF routes', () => {
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
    handler = (_req, res) => json(res, upload);
  });
  const call = (
    path = `${images}/${imageId}`,
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

  const endpoints: [string, string, unknown?][] = [
    ['GET', images + '?articleId=' + id],
    ['GET', `${images}/${imageId}`],
    ['POST', images, reservation],
    ['DELETE', `${images}/${imageId}`, { expectedRevision: 1 }],
    ['PUT', `${images}/${imageId}/content`, sourceBytes],
    ...previews.map((path): [string, string] => ['GET', path]),
  ];
  it.each(
    endpoints.map(([method, path, body]) => [method, path, body] as const)
  )('requires trusted identity for %s %s', async (method, path, body) => {
    expect((await call(path, { method, body, headers: {} })).status).toBe(401);
    expect(observed).toHaveLength(0);
  });
  it.each(
    endpoints.map(([method, path, body]) => [method, path, body] as const)
  )('rejects extra selectors for %s %s', async (method, path, body) => {
    expect(
      (
        await call(path + (path.includes('?') ? '&' : '?') + 'tenant=other', {
          method,
          body,
        })
      ).status
    ).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    [images + '?articleId=' + id, [upload]],
    [`${images}/${imageId}`, upload],
  ])('reads %s', async (path, value) => {
    handler = (_req, res) => json(res, value);
    expect(await (await call(String(path))).json()).toEqual(value);
  });
  it.each([
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
  ] as const)(
    'forwards cover command %s',
    async (path, body, method, result) => {
      handler = (_req, res) => json(res, result, method === 'POST' ? 201 : 200);
      expect(await (await command(path, body, method)).json()).toEqual(result);
      expect(observed).toHaveLength(1);
      expect(JSON.parse(observed[0].bytes.toString())).toEqual(body);
      expect(observed[0].headers['idempotency-key']).toBe('stable-key');
    }
  );
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
      images + '?articleId=' + id,
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
  it.each([
    images,
    images + '?articleId=bad',
    images + `?articleId=${id}&articleId=${other}`,
    `${images}/${imageId}?tenant=other`,
    `${drafts}/${id}/submissions/0/cover`,
    `${drafts}/${id}/submissions/9007199254740992/cover`,
    `/api/media/articles/${id}/bad`,
  ])('rejects invalid selector %s', async (path) => {
    expect((await call(path)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
  it.each([
    { ...reservation, owner: 'other' },
    { ...reservation, articleId: 'bad' },
    { ...reservation, source: { ...descriptor, contentType: 'image/svg+xml' } },
    { ...reservation, source: { ...descriptor, bytes: 8388609 } },
    { ...reservation, source: { ...descriptor, sha256: 'bad' } },
  ])('rejects malformed reservation %#', async (body) => {
    expect((await command(images, body)).status).toBe(400);
    expect(observed).toHaveLength(0);
  });
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
        images,
        {
          'idempotency-key': ['one', 'two'],
          'content-type': 'application/json',
        },
        Buffer.from(JSON.stringify(reservation))
      )
    ).toBe(400);
    expect(
      await raw(
        'GET',
        images,
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
      for (const path of [`${images}/${imageId}`, previews[0]]) {
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
    [images + '?articleId=' + id, [upload, upload]],
    [images + '?articleId=' + id, [{ ...upload, articleId: other }]],
    [images + '?articleId=' + id, [{ ...upload, status: 'cancelled' }]],
    [`${images}/${imageId}`, { ...upload, id: other }],
    [`${images}/${imageId}`, { ...upload, status: 'ready' }],
    [`${images}/${imageId}`, { ...upload, internal: 'secret' }],
  ])('rejects mismatched upload metadata %#', async (path, value) => {
    handler = (_req, res) => json(res, value);
    expect((await call(String(path))).status).toBe(503);
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
    expect((await command(images, reservation)).status).toBe(503);
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
