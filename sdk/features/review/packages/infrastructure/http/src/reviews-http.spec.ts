import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import {
  ReviewDeniedError,
  ReviewConflictError,
  ReviewInputError,
  ReviewMissingError,
} from '@sdk/features/review/core';
import {
  REVIEW_HTTP_OPTIONS,
  ReviewsController,
  type ReviewHttpOptions,
} from './index';

const bindingKey = 'NewConsumer|Item@v987/a:b?x=2&Y=3';
const id = '10000000-0000-4000-8000-000000000001';
const query = '?bindingKey=' + encodeURIComponent(bindingKey);
const actor = { identityId: 'Author', tenantId: 'Tenant', roles: [] };
const key = 'stable-command-key-0001';
const receipt = { id, revision: 2 };
const summary = {
  total: 0,
  average: null,
  distribution: [0, 0, 0, 0, 0] as [number, number, number, number, number],
};
const member = {
  id,
  bindingKey,
  revision: 2,
  contentRevision: 1,
  content: { displayName: 'Public member', rating: 4, text: 'Review text.' },
  withdrawn: false,
  hidden: false,
  moderationReason: null,
  createdAt: 1,
  updatedAt: 1,
  helpfulCount: 0,
  helpful: false,
  reported: false,
  mine: false,
  canModerate: false,
  openReports: null,
};
const results = {
  summary,
  read: member,
  page: { items: [], next: null, mine: null, summary, canModerate: false },
  reports: { items: [], next: null },
  change: receipt,
};
const endpoints = [
  ['GET', '', 'page', false],
  ['GET', '/summary', 'summary', false],
  ['GET', '/' + id, 'read', false],
  ['GET', '/moderation', 'page', true],
  ['GET', '/' + id + '/reports', 'reports', true],
  ['PUT', '/mine', 'change', true],
  ['DELETE', '/' + id, 'change', true],
  ['PUT', '/' + id + '/helpful', 'change', true],
  ['POST', '/' + id + '/reports', 'change', true],
  ['PUT', '/' + id + '/moderation', 'change', true],
] as const;

describe('generic Review HTTP contract', () => {
  let app: INestApplication, origin: string;
  const reviews: jest.Mocked<ReviewHttpOptions['reviews']> = {
    summary: jest.fn(),
    page: jest.fn(),
    read: jest.fn(),
    reports: jest.fn(),
    change: jest.fn(),
  };
  beforeAll(async () => {
    const options: ReviewHttpOptions = {
      reviews,
      actor: (request, required) => {
        if (request.headers.authorization === 'Bearer fixture') return actor;
        if (
          required ||
          request.headers.authorization ||
          request.headers['x-user-id']
        )
          throw new UnauthorizedException();
        return null;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: REVIEW_HTTP_OPTIONS, useValue: options }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    reviews.summary.mockResolvedValue(results.summary);
    reviews.page.mockResolvedValue(results.page);
    reviews.read.mockResolvedValue(results.read);
    reviews.reports.mockResolvedValue(results.reports);
    reviews.change.mockResolvedValue(results.change);
  });
  async function call(
    method: string,
    suffix: string,
    selectors = query,
    token: string | null = 'fixture',
    body: unknown = { expectedRevision: 1 }
  ) {
    return fetch(origin + '/api/reviews' + suffix + selectors, {
      method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Idempotency-Key': key,
        'Content-Type': 'application/json',
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
  }

  it.each(endpoints)(
    'dispatches %s %s with an exact opaque key',
    async (method, suffix, operation) => {
      const response = await call(method, suffix);
      expect(response.status).toBe(method === 'POST' ? 201 : 200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual(results[operation]);
      expect(reviews[operation].mock.calls[0][0]).toBe(bindingKey);
      if (operation === 'change') {
        expect(reviews.change).toHaveBeenCalledWith(
          bindingKey,
          suffix === '/mine' ? null : id,
          suffix === '/mine'
            ? 'publish'
            : suffix.endsWith('/helpful')
            ? 'helpful'
            : suffix.endsWith('/reports')
            ? 'report'
            : suffix.endsWith('/moderation')
            ? 'moderate'
            : 'withdraw',
          { expectedRevision: 1 },
          actor,
          key
        );
      }
    }
  );
  it.each(endpoints)(
    'rejects forged scope for %s %s before dispatch',
    async (method, suffix) => {
      for (const selectors of [
        '',
        '?bindingKey=',
        query + '&bindingKey=other',
        query + '&tenantId=other',
        query + '&applicationId=' + id,
        '?bindingKey[x]=nested',
        '?bindingKey=%20x',
        query + '&cursor=bad',
      ]) {
        expect((await call(method, suffix, selectors)).status).toBe(400);
      }
      for (const method of Object.values(reviews))
        expect(method).not.toHaveBeenCalled();
    }
  );
  it.each(endpoints.filter(([, , , required]) => required))(
    'requires trusted actor for %s %s',
    async (method, suffix) => {
      expect((await call(method, suffix, query, null)).status).toBe(401);
      for (const method of Object.values(reviews))
        expect(method).not.toHaveBeenCalled();
    }
  );
  it.each(endpoints.filter(([, , , required]) => !required))(
    'supports anonymous reads for %s %s',
    async (method, suffix, operation) => {
      expect((await call(method, suffix, query, null)).status).toBe(200);
      expect(reviews[operation].mock.calls[0]).toContain(null);
    }
  );
  it.each(['', '/moderation', '/' + id + '/reports'])(
    'preserves bounded cursor for %s',
    async (suffix) => {
      const cursor = '1234.' + id;
      expect(
        (await call('GET', suffix, query + '&cursor=' + cursor)).status
      ).toBe(200);
      const operation = suffix.endsWith('/reports')
        ? reviews.reports
        : reviews.page;
      expect(operation.mock.calls[0]).toContain(cursor);
      expect(
        (
          await call(
            'GET',
            suffix,
            query + '&cursor=' + cursor + '&cursor=' + cursor
          )
        ).status
      ).toBe(400);
    }
  );
  it.each([
    [new ReviewInputError('Invalid'), 400],
    [new ReviewDeniedError('Denied'), 403],
    [new ReviewMissingError('Missing'), 404],
    [new ReviewConflictError('Conflict'), 409],
    [new Error('Secret dependency configuration'), 503],
  ] as const)('preserves domain error %s as %s', async (error, status) => {
    reviews.change.mockRejectedValue(error);
    const response = await call('PUT', '/mine');
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('Secret');
  });
  it('rejects duplicate command headers and read bodies', async () => {
    for (const method of ['PUT', 'GET']) {
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const request = httpRequest(
            origin + '/api/reviews' + (method === 'PUT' ? '/mine' : '') + query,
            {
              method,
              headers: [
                'Authorization',
                'Bearer fixture',
                'Idempotency-Key',
                key,
                'Idempotency-Key',
                key,
                'Content-Type',
                'application/json',
                'Content-Length',
                '2',
              ],
            },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            }
          );
          request.on('error', reject);
          request.end('{}');
        }
      );
      expect(status).toBe(400);
    }
    expect(reviews.change).not.toHaveBeenCalled();
    expect(reviews.page).not.toHaveBeenCalled();
  });
  it('has no dedicated consumer or binding-resource aliases', async () => {
    for (const path of [
      '/api/application-reviews/' + id,
      '/api/review-bindings',
    ]) {
      expect((await fetch(origin + path)).status).toBe(404);
    }
  });
});
