import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { err, ok } from '@sdk/kernel/standard';
import { IdentityAuthenticationUnavailable } from '@sdk/features/identity/libs/authentication';
import { TokenValidationService } from '../services/token-validation.service';
import { ValidationController } from './validation.controller';

describe('optional ingress validation scope', () => {
  it.each([
    [new Error('Revoked token'), 401],
    [new IdentityAuthenticationUnavailable('SQL unavailable'), 503],
  ])(
    'does not grant anonymous ingress authority to rejected tokens',
    async (error, status) => {
      const module = await Test.createTestingModule({
        providers: [
          ValidationController,
          {
            provide: TokenValidationService,
            useValue: { validateOptional: async () => err(error) },
          },
          {
            provide: ConfigService,
            useValue: new ConfigService({ INGRESS_AUTH_SECRET: 'secret' }),
          },
        ],
      }).compile();
      const response = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      await module
        .get(ValidationController)
        .validateOptional('Bearer rejected', response as unknown as Response);
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.setHeader).not.toHaveBeenCalled();
      await module.close();
    }
  );
  it('preserves verified tenant and roles on authenticated optional requests', async () => {
    const principal = {
      uid: 'firebase-uid',
      email: 'actor@example.test',
      authTime: 100,
      claims: { tenantId: 'tenant', roles: ['discussion:writer'] },
    };
    const module = await Test.createTestingModule({
      providers: [
        ValidationController,
        {
          provide: TokenValidationService,
          useValue: {
            validateOptional: async () =>
              ok({ authenticated: true, principal }),
          },
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({ INGRESS_AUTH_SECRET: 'secret' }),
        },
      ],
    }).compile();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await module
      .get(ValidationController)
      .validateOptional('Bearer token', response as unknown as Response);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-User-Id',
      'firebase-uid'
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Auth-Time', '100');
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-User-Claims',
      JSON.stringify(principal.claims)
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Ingress-Auth', 'secret');
    await module.close();
  });

  it('does not invent scope for anonymous optional access', async () => {
    const module = await Test.createTestingModule({
      providers: [
        ValidationController,
        {
          provide: TokenValidationService,
          useValue: {
            validateOptional: async () => ok({ authenticated: false }),
          },
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({ INGRESS_AUTH_SECRET: 'secret' }),
        },
      ],
    }).compile();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    await module
      .get(ValidationController)
      .validateOptional(undefined, response as unknown as Response);
    expect(response.setHeader).toHaveBeenCalledWith('X-Anonymous', 'true');
    expect(response.setHeader.mock.calls.map((call) => call[0])).not.toContain(
      'X-User-Claims'
    );
    await module.close();
  });
});
