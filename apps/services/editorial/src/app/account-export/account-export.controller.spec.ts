import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { err, ok } from '@sdk/kernel/standard';
import type { AccountExportEntry } from '@sdk/features/identity/core';
import { AccountExportSourceAccess } from '@sdk/features/identity/libs/management';
import { ConfigService } from '@nestjs/config';
import { EditorialAuthMiddleware } from '../http/editorial-auth';
import { AccountExportController } from './account-export.controller';

describe('internal Editorial export HTTP stream', () => {
  let app: INestApplication, origin: string;
  const previous = process.env.ACCOUNT_EXPORT_SOURCE_SECRET;
  const secret = 'q'.repeat(48),
    evaluate = jest.fn(),
    capture = jest.fn();
  beforeAll(async () => {
    process.env.ACCOUNT_EXPORT_SOURCE_SECRET = secret;
    @Module({
      controllers: [AccountExportController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (name: string) =>
              name === 'ACCOUNT_EXPORT_SOURCE_SECRET'
                ? secret
                : name === 'INGRESS_AUTH_SECRET'
                ? 'ingress-secret'
                : undefined,
          },
        },
        EditorialAuthMiddleware,
        {
          provide: AccountExportSourceAccess,
          useValue: new AccountExportSourceAccess(
            { name: 'editorial', capture },
            { evaluate }
          ),
        },
      ],
    })
    class HttpModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer
          .apply(EditorialAuthMiddleware)
          .forRoutes(AccountExportController);
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
    capture
      .mockReset()
      .mockImplementation(
        async function* (): AsyncIterable<AccountExportEntry> {
          yield { type: 'begin', source: 'editorial', at: 1 };
          yield {
            type: 'record',
            source: 'editorial',
            collection: 'contributions',
            data: { content: 'My text' },
          };
          yield { type: 'end', source: 'editorial', at: 2, records: 1 };
        }
      );
  });
  afterAll(async () => {
    await app?.close();
    if (previous === undefined) delete process.env.ACCOUNT_EXPORT_SOURCE_SECRET;
    else process.env.ACCOUNT_EXPORT_SOURCE_SECRET = previous;
  });
  function post(
    body: unknown = { identityId: 'Member' },
    headers: Record<string, string> = { 'x-account-export-reader': secret },
    query = '',
    signal?: AbortSignal
  ) {
    return fetch(`${origin}/api/internal/account-export${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  }
  it('streams complete bounded NDJSON through service authentication and policy', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/x-ndjson'
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const entries = (await response.text())
      .trim()
      .split('\n')
      .map((value) => JSON.parse(value));
    expect(entries.map((row) => row.type)).toEqual(['begin', 'record', 'end']);
    expect(entries[2].records).toBe(1);
    expect(capture).toHaveBeenCalledWith('Member', expect.any(AbortSignal));
  });
  it('rejects public/user authentication and injected tenant scope before reading', async () => {
    const attempts: Record<string, string>[] = [
      {},
      { 'x-user-id': 'Member' },
      { 'x-account-export-reader': secret, 'x-user-id': 'Member' },
    ];
    for (const headers of attempts)
      expect((await post({ identityId: 'Member' }, headers)).status).toBe(401);
    expect(
      (await post({ identityId: 'Member', tenantId: 'foreign' })).status
    ).toBe(400);
    expect(
      (await post({ identityId: 'Member' }, undefined, '?tenantId=foreign'))
        .status
    ).toBe(400);
    expect(capture).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });
  it('reports policy denial and outage without starting a stream', async () => {
    evaluate.mockResolvedValue(ok(false));
    expect((await post()).status).toBe(403);
    evaluate.mockResolvedValue(err(new Error('Private provider diagnostics')));
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('Private provider diagnostics');
    expect(capture).not.toHaveBeenCalled();
  });
  it('does not acknowledge truncated captures or leak internal failures', async () => {
    capture.mockImplementation(async function* () {
      throw new Error('Private SQL diagnostic');
      yield;
    });
    const failed = await post();
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('Private SQL');
    capture.mockImplementation(async function* () {
      yield { type: 'begin', source: 'editorial', at: 1 };
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await expect(
      (async () => {
        const response = await post();
        return response.text();
      })()
    ).rejects.toThrow();
  });
  it('cancels source work when the consumer disconnects', async () => {
    let completed: () => void = () => undefined;
    const closed = new Promise<void>((resolve) => {
      completed = resolve;
    });
    capture.mockImplementation(async function* (
      _id: string,
      signal: AbortSignal
    ) {
      yield { type: 'begin', source: 'editorial', at: 1 };
      await new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener('abort', () => resolve(), { once: true });
      });
      completed();
      signal.throwIfAborted();
    });
    const controller = new AbortController();
    const response = await post(undefined, undefined, '', controller.signal);
    expect(response.status).toBe(200);
    controller.abort();
    await closed;
  });
});
