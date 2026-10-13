import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ok } from '@sdk/kernel/standard';
import { AuthValidationMiddleware } from '../middleware/auth-validation.middleware';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';
import { DurableDiscussionCommands } from './application/durable-discussion-commands';
import { DiscussionQueries } from './application/discussion-queries';
import {
  DiscussionResource,
  DiscussionWriteRepository,
} from './application/discussion-write.port';

describe('discussion HTTP authorization and commit contract', () => {
  let app: INestApplication;
  let origin: string;
  const id = '00000000-0000-4000-8000-000000000001';
  const evaluate = jest.fn();
  const put = jest.fn();
  const root: DiscussionResource = {
    id,
    discussionId: id,
    revision: 1,
    tenantId: 'default',
    ownerIdentityId: 'owner',
    rootOwnerIdentityId: 'owner',
    kind: 'discussion',
    state: 'published',
    visibility: 'public',
    rootState: 'published',
    rootVisibility: 'public',
    deletedAt: null,
    rootDeletedAt: null,
  };
  const writes: jest.Mocked<DiscussionWriteRepository> = {
    resource: jest.fn(),
    resources: jest.fn(),
    receipt: jest.fn(),
    commit: jest.fn(),
  };
  const previousSecret = process.env.INGRESS_AUTH_SECRET;

  beforeAll(async () => {
    process.env.INGRESS_AUTH_SECRET = 'http-test-secret';
    const commands = new DurableDiscussionCommands(
      writes,
      { put },
      { evaluate },
      { generate: () => id }
    );
    const queries = new DiscussionQueries(
      writes,
      { heads: async () => [], head: async () => null, nodes: async () => [] },
      'default'
    );
    @Module({
      controllers: [DiscussionsController],
      providers: [
        {
          provide: DiscussionsService,
          useValue: new DiscussionsService(commands, queries),
        },
        AuthValidationMiddleware,
      ],
    })
    class HttpModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer
          .apply(AuthValidationMiddleware)
          .forRoutes(DiscussionsController);
      }
    }
    const module = await Test.createTestingModule({
      imports: [HttpModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    evaluate.mockResolvedValue(ok(true));
    put.mockResolvedValue({ key: 'immutable', sha256: 'hash', bytes: 20 });
    writes.resource.mockResolvedValue(root);
    writes.resources.mockResolvedValue([root]);
    writes.receipt.mockResolvedValue(null);
    writes.commit.mockResolvedValue({
      id,
      discussionId: id,
      revision: 1,
      projection: 'pending',
    });
  });
  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.INGRESS_AUTH_SECRET;
    else process.env.INGRESS_AUTH_SECRET = previousSecret;
  });

  function post(
    headers: Record<string, string> = {},
    content: unknown = { content: 'body' }
  ) {
    return fetch(`${origin}/discussions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(content),
    });
  }
  const authenticated = {
    'x-user-id': 'owner',
    'x-ingress-auth': 'http-test-secret',
    'idempotency-key': 'request-1',
  };

  it('returns 401 for missing, forged or anonymous mutation identity', async () => {
    const attempts: Array<Record<string, string>> = [
      {},
      { 'x-user-id': 'owner' },
      { 'x-anonymous': 'true', 'x-ingress-auth': 'http-test-secret' },
    ];
    for (const headers of attempts) {
      expect((await post(headers)).status).toBe(401);
    }
    expect(put).not.toHaveBeenCalled();
    expect(writes.commit).not.toHaveBeenCalled();
  });

  it('returns 403 for a policy denial, with no accepted-write response', async () => {
    evaluate.mockResolvedValue(ok(false));
    const response = await post(authenticated);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ statusCode: 403 });
    expect(writes.commit).not.toHaveBeenCalled();
  });

  it('rejects missing idempotency and injected ownership fields', async () => {
    expect(
      (
        await post({
          'x-user-id': 'owner',
          'x-ingress-auth': 'http-test-secret',
        })
      ).status
    ).toBe(400);
    expect(
      (
        await post(authenticated, {
          content: 'body',
          ownerIdentityId: 'victim',
        })
      ).status
    ).toBe(400);
    expect(writes.commit).not.toHaveBeenCalled();
  });

  it('returns the committed identity/revision while truthfully marking projection pending', async () => {
    const response = await post(authenticated);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id,
      discussionId: id,
      revision: 1,
      projection: 'pending',
    });
  });

  it('returns 409 for stale edits before uploading', async () => {
    const response = await fetch(`${origin}/discussions/${id}`, {
      method: 'PUT',
      headers: { ...authenticated, 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'edit', expectedRevision: 2 }),
    });
    expect(response.status).toBe(409);
    expect(put).not.toHaveBeenCalled();
  });

  it('returns retryable 503 for an authoritative discussion awaiting its projection', async () => {
    const response = await fetch(`${origin}/discussions/${id}`);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(await response.json()).toMatchObject({
      message: 'Discussion projection is pending',
    });
  });
});
