import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { err, ok } from '@sdk/kernel/standard';
import { CanonicalIdentityConflict } from '@sdk/features/identity/core';
import { AccountErasureAccess } from '@sdk/features/identity/libs/management';
import { AuthValidationMiddleware } from '../middleware/auth-validation.middleware';
import { AccountErasureController } from './account-erasure.controller';

describe('internal Discussion erasure HTTP boundary', () => {
  let app: INestApplication, origin: string;
  const previous = process.env.ACCOUNT_ERASURE_SECRET;
  const secret = 'qualification-erasure-secret-2026-only';
  const evaluate = jest.fn(),
    request = jest.fn();
  const input = { identityId: 'Member', revision: 7 };
  const receipt = { ...input, participant: 'discussion', state: 'pending' };
  beforeAll(async () => {
    process.env.ACCOUNT_ERASURE_SECRET = secret;
    @Module({
      controllers: [AccountErasureController],
      providers: [
        AuthValidationMiddleware,
        {
          provide: AccountErasureAccess,
          useValue: new AccountErasureAccess(
            { name: 'discussion', request },
            { evaluate }
          ),
        },
      ],
    })
    class HttpModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer
          .apply(AuthValidationMiddleware)
          .forRoutes(AccountErasureController);
      }
    }
    const module = await Test.createTestingModule({
      imports: [HttpModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  beforeEach(() => {
    evaluate.mockReset().mockResolvedValue(ok(true));
    request.mockReset().mockResolvedValue(receipt);
  });
  afterAll(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.ACCOUNT_ERASURE_SECRET;
    else process.env.ACCOUNT_ERASURE_SECRET = previous;
  });
  const post = (
    body: unknown = input,
    headers: Record<string, string> = { 'x-account-erasure-writer': secret },
    query = ''
  ) =>
    fetch(`${origin}/api/internal/account-erasure${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  it('reports accepted work as pending, with private caching', async () => {
    const response = await post();
    expect(response.status).toBe(202);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual(receipt);
    expect(request).toHaveBeenCalledWith(input);
  });
  it('reports a completed durable receipt as 200', async () => {
    request.mockResolvedValue({ ...receipt, state: 'completed' });
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...receipt, state: 'completed' });
  });
  it.each([
    'authorization',
    'x-user-id',
    'x-user-email',
    'x-user-claims',
    'x-auth-time',
    'x-anonymous',
    'x-ingress-auth',
    'x-profile-reader',
    'x-account-export-reader',
    'x-tenant-id',
    'x-roles',
  ])(
    'rejects mixed %s authentication before policy or persistence',
    async (header) => {
      expect(
        (
          await post(input, {
            'x-account-erasure-writer': secret,
            [header]: 'other',
          })
        ).status
      ).toBe(401);
      expect(evaluate).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
    }
  );
  it('denies missing and incorrect credentials', async () => {
    expect((await post(input, {})).status).toBe(401);
    expect(
      (await post(input, { 'x-account-erasure-writer': 'wrong' })).status
    ).toBe(401);
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, revision: 0 },
    { ...input, revision: '7' },
    { ...input, identityId: '' },
    { ...input, extra: true },
    [],
  ])('rejects malformed body %j', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  });
  it('rejects query parameters and conflicting deletion revisions', async () => {
    expect((await post(input, undefined, '?identityId=other')).status).toBe(
      400
    );
    expect(request).not.toHaveBeenCalled();
    request.mockRejectedValue(
      new CanonicalIdentityConflict('revision differs')
    );
    expect((await post()).status).toBe(409);
  });
  it('distinguishes policy denial from outage without writing', async () => {
    evaluate.mockResolvedValue(ok(false));
    expect((await post()).status).toBe(403);
    evaluate.mockResolvedValue(err(new Error('offline')));
    const response = await post();
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(request).not.toHaveBeenCalled();
  });
  it('does not turn a persistence failure into acceptance', async () => {
    request.mockRejectedValue(new Error('private database detail'));
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database detail');
  });
});
