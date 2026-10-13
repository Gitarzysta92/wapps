import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { IdentityAuthenticationUnavailable } from '@sdk/features/identity/libs/authentication';
import { err, ok } from '@sdk/kernel/standard';
import { AuthController } from './auth.controller';
import { TokenValidationService } from '../services/token-validation.service';
import {
  ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
  EMAIL_AUTHENTICATION_STRATEGY_FACTORY,
  GITHUB_AUTHENTICATION_STRATEGY_FACTORY,
  GOOGLE_AUTHENTICATION_STRATEGY_FACTORY,
  IDENTITY_AUTH_SERVICE,
} from '../tokens';

describe('authentication HTTP failure contract', () => {
  const service = { authenticate: jest.fn(), refresh: jest.fn() };
  let controller: AuthController;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: IDENTITY_AUTH_SERVICE, useValue: service },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: TokenValidationService, useValue: {} },
        ...[
          ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
          EMAIL_AUTHENTICATION_STRATEGY_FACTORY,
          GITHUB_AUTHENTICATION_STRATEGY_FACTORY,
          GOOGLE_AUTHENTICATION_STRATEGY_FACTORY,
        ].map((provide) => ({ provide, useValue: { create: () => ({}) } })),
      ],
    }).compile();
    controller = module.get(AuthController);
  });
  beforeEach(() => jest.resetAllMocks());
  function response() {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return { res, response: res as unknown as Response };
  }
  it('reports failed identity persistence as 503 without SQL details', async () => {
    const f = response();
    service.authenticate.mockResolvedValue(
      err(new IdentityAuthenticationUnavailable('private storage error'))
    );
    await controller.signIn(
      { email: 'alice@example.test', password: 'password' },
      f.response
    );
    expect(f.res.status).toHaveBeenCalledWith(503);
    expect(f.res.json).toHaveBeenCalledWith({
      error: 'Authentication service unavailable',
    });
  });
  it('distinguishes rejected credentials from unavailable storage', async () => {
    const f = response();
    service.authenticate.mockResolvedValue(
      err(new Error('Invalid credentials'))
    );
    await controller.signIn(
      { email: 'alice@example.test', password: 'password' },
      f.response
    );
    expect(f.res.status).toHaveBeenCalledWith(401);
  });
  it('keeps a successful session contract', async () => {
    const f = response();
    service.authenticate.mockResolvedValue(ok({ uid: 'Uid', token: 'token' }));
    await controller.signIn(
      { email: 'alice@example.test', password: 'password' },
      f.response
    );
    expect(f.res.status).toHaveBeenCalledWith(200);
    expect(f.res.json).toHaveBeenCalledWith({ uid: 'Uid', token: 'token' });
  });
  it('does not misreport identity lookup failure as an invalid refresh token', async () => {
    const f = response();
    service.refresh.mockResolvedValue(
      err(new IdentityAuthenticationUnavailable('storage'))
    );
    await controller.refresh({ refreshToken: 'refresh' }, f.response);
    expect(f.res.status).toHaveBeenCalledWith(503);
  });
});
