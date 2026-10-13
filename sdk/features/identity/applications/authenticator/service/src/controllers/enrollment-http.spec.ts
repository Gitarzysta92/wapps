import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CredentialRegistrationService,
  CredentialPasswordResetService,
  IdentityAuthenticationUnavailable,
  PasswordResetRejected,
} from '@sdk/features/identity/libs/authentication';
import { CanonicalIdentityConflict } from '@sdk/features/identity/core';
import { DataSource } from 'typeorm';
import { err, ok } from '@sdk/kernel/standard';
import { CANONICAL_IDENTITIES } from '../services/mysql-identity-provider';
import { IdentityEventsPublisherHolder } from '../services/identity-events-publisher.holder';

describe('enrollment production HTTP composition', () => {
  const registration = { register: jest.fn() };
  const reset = { verify: jest.fn(), complete: jest.fn() };
  let app: INestApplication;
  let origin: string;
  let enabled = true;
  const env = {
    MYSQL_HOST: 'unused',
    MYSQL_PORT: '3306',
    MYSQL_DATABASE: 'test',
    MYSQL_USERNAME: 'test',
    MYSQL_PASSWORD: 'test',
    QUEUE_HOST: 'unused',
    QUEUE_USERNAME: 'test',
    QUEUE_PASSWORD: 'test',
    FIREBASE_PROJECT_ID: 'test',
    FIREBASE_WEB_API_KEY: 'test',
    INGRESS_AUTH_SECRET: 'test',
  };
  const previous = new Map<string, string | undefined>();
  beforeAll(async () => {
    for (const [key, value] of Object.entries(env)) {
      previous.set(key, process.env[key]);
      process.env[key] = value;
    }
    const { AppModule } = await import('../app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue({ options: { type: 'mysql' }, entityMetadatas: [] })
      .overrideProvider(CANONICAL_IDENTITIES)
      .useValue({})
      .overrideProvider(IdentityEventsPublisherHolder)
      .useValue({})
      .overrideProvider(CredentialRegistrationService)
      .useValue(registration)
      .overrideProvider(CredentialPasswordResetService)
      .useValue(reset)
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          key === 'ENABLE_EMAIL_PASSWORD'
            ? String(enabled)
            : env[key as keyof typeof env],
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
        validationError: { target: false, value: false },
      })
    );
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  beforeEach(() => {
    jest.resetAllMocks();
    enabled = true;
    registration.register.mockResolvedValue(ok({ uid: 'Uid', token: 'token' }));
    reset.verify.mockResolvedValue(ok(undefined));
    reset.complete.mockResolvedValue(ok(undefined));
  });
  const input = {
    email: 'alice@example.test',
    nickname: 'Alice',
    password: 'password',
    passwordConfirmation: 'password',
  };
  const request = (path: string, body: unknown) =>
    fetch(`${origin}/auth/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'command-1',
      },
      body: JSON.stringify(body),
    });
  it('wires registration, forwards the command key and marks sessions noncacheable', async () => {
    const response = await request('register', input);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(registration.register).toHaveBeenCalledWith(input, 'command-1');
  });
  it.each([
    { uid: 'attacker' },
    { nickname: 123 },
    { password: 123456 },
    { email: 'bad' },
  ])(
    'rejects caller-controlled identity and malformed input: %j',
    async (patch) => {
      expect((await request('register', { ...input, ...patch })).status).toBe(
        400
      );
      expect(registration.register).not.toHaveBeenCalled();
    }
  );
  it('retains enrollment conflict status', async () => {
    registration.register.mockResolvedValue(
      err(new CanonicalIdentityConflict('Already registered'))
    );
    expect((await request('register', input)).status).toBe(409);
  });
  it('withholds sessions and storage details on unavailable registration', async () => {
    registration.register.mockResolvedValue(
      err(new IdentityAuthenticationUnavailable('private SQL'))
    );
    const response = await request('register', input);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private SQL');
  });
  it('verifies action codes through a public POST without exposing target email', async () => {
    const response = await request('password-reset/verify', { code: 'code' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
    expect(reset.verify).toHaveBeenCalledWith('code');
  });
  it('completes a reset only through its password-bearing contract', async () => {
    const body = {
      code: 'code',
      password: 'password',
      passwordConfirmation: 'password',
    };
    expect((await request('password-reset/complete', body)).status).toBe(200);
    expect(reset.complete).toHaveBeenCalledWith(body);
    expect(
      (await request('password-reset/complete', { code: 'code' })).status
    ).toBe(400);
  });
  it('reports expired action codes as errors', async () => {
    reset.verify.mockResolvedValue(err(new PasswordResetRejected('Expired')));
    expect(
      (await request('password-reset/verify', { code: 'code' })).status
    ).toBe(400);
  });
  it('honors the email/password feature switch before commands', async () => {
    enabled = false;
    expect((await request('register', input)).status).toBe(403);
    expect(
      (await request('password-reset/verify', { code: 'code' })).status
    ).toBe(403);
    expect(registration.register).not.toHaveBeenCalled();
    expect(reset.verify).not.toHaveBeenCalled();
  });
});
