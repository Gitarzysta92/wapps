import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { HttpException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import { PortalAuthClient } from './portal-auth.client';
import { PortalAuthController } from './portal-auth.controller';

describe('portal authentication boundary', () => {
  const request = jest.fn(),
    get = jest.fn();
  const client = new PortalAuthClient(
    { request, get } as unknown as HttpService,
    new ConfigService({
      AUTHENTICATOR_URL: 'http://auth.internal',
      ACCOUNT_MANAGEMENT_URL: 'http://account.internal',
    })
  );
  const controller = new PortalAuthController(client);
  const session = {
    uid: 'subject',
    token: 'token',
    refreshToken: 'refresh',
    expiresIn: '3600',
  };
  const response = (data: unknown, status = 200) =>
    of({ status, headers: { 'content-type': 'application/json' }, data });
  const incoming = (body: unknown, headers: string[] = []) =>
    ({
      body,
      query: {},
      rawHeaders: headers,
      headers: Object.fromEntries(
        headers.flatMap((value, index) =>
          index % 2 === 0 ? [[value.toLowerCase(), headers[index + 1]]] : []
        )
      ),
    } as unknown as Request);
  const outgoing = () => {
    const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
    res.status.mockReturnValue(res);
    return res as unknown as Response;
  };
  beforeEach(() => jest.resetAllMocks());

  it('preserves session shape while withholding owner details and caller-supplied authority', async () => {
    request.mockReturnValue(
      response({ ...session, privateProviderData: 'private' })
    );
    const res = outgoing();
    await controller.signIn(
      incoming({ email: 'member@example.test', password: 'password' }, [
        'X-User-Id',
        'admin',
        'X-Ingress-Auth',
        'forged',
      ]),
      res
    );
    expect(res.json).toHaveBeenCalledWith(session);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(request.mock.calls[0][0]).toMatchObject({
      url: 'http://account.internal/api/auth/signin',
      maxRedirects: 0,
    });
    expect(request.mock.calls[0][0].headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });
  it('passes registration idempotency without allowing role assignment', async () => {
    const body = {
      email: 'member@example.test',
      password: 'password',
      passwordConfirmation: 'password',
      nickname: 'Member',
    };
    request.mockReturnValue(response(session));
    await controller.register(
      incoming(body, ['Idempotency-Key', 'enrollment-1']),
      outgoing()
    );
    expect(request.mock.calls[0][0].headers['Idempotency-Key']).toBe(
      'enrollment-1'
    );
    expect(() =>
      controller.register(
        incoming({ ...body, roles: ['admin'] }, [
          'Idempotency-Key',
          'enrollment-2',
        ]),
        outgoing()
      )
    ).toThrow('Unexpected authentication field');
    expect(() => controller.register(incoming(body), outgoing())).toThrow(
      'Idempotency-Key'
    );
  });
  it('refreshes with the refresh credential, without forwarding a stale bearer or inventing retries', async () => {
    request.mockReturnValue(
      throwError(() => ({
        isAxiosError: true,
        response: { status: 401, data: 'private' },
      }))
    );
    await expect(
      controller.refresh(
        incoming({ refreshToken: 'old' }, ['Authorization', 'Bearer expired']),
        outgoing()
      )
    ).rejects.toMatchObject({ status: 401 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].headers).not.toHaveProperty(
      'Authorization'
    );
  });
  it('requires a bearer for sign-out and forwards only that credential', async () => {
    expect(() => controller.signOut(incoming({}), outgoing())).toThrow(
      'Sign in again'
    );
    request.mockReturnValue(response({ message: 'Signed out successfully' }));
    await controller.signOut(
      incoming({}, ['Authorization', 'Bearer token', 'X-User-Id', 'forged']),
      outgoing()
    );
    expect(request.mock.calls[0][0].headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    });
  });
  it('does not report successful sign-out when the owner fails', async () => {
    request.mockReturnValue(
      throwError(() => new Error('private credential service'))
    );
    const res = outgoing();
    await expect(
      controller.signOut(incoming({}, ['Authorization', 'Bearer token']), res)
    ).rejects.toMatchObject({ status: 503 });
    expect(res.json).not.toHaveBeenCalled();
  });
  it.each([
    { ...session, expiresIn: '0' },
    { ...session, uid: '' },
    { ...session, token: 'a b' },
    { message: 'wrong contract' },
  ])('rejects malformed successful session responses: %j', async (data) => {
    request.mockReturnValue(response(data));
    await expect(client.execute('signin', {})).rejects.toMatchObject({
      status: 503,
    });
  });
  it('advertises only confirmed configured methods', async () => {
    const methods = [
      {
        provider: 'EMAIL_PASSWORD',
        enabled: true,
        displayName: 'Email & Password',
      },
    ];
    request.mockReturnValue(response({ methods }));
    expect(await client.execute('methods')).toEqual({ methods });
    request.mockReturnValue(response({ methods: [...methods, ...methods] }));
    await expect(client.execute('methods')).rejects.toMatchObject({
      status: 503,
    });
  });
  it('preserves the accepted password recovery contract and unavailable delivery', async () => {
    request.mockReturnValue(response({ accepted: true }, 202));
    expect(await client.recovery({ email: 'member@example.test' })).toEqual({
      accepted: true,
    });
    request.mockReturnValue(
      throwError(() => ({ isAxiosError: true, response: { status: 503 } }))
    );
    await expect(
      client.recovery({ email: 'member@example.test' })
    ).rejects.toBeInstanceOf(HttpException);
  });
  it('does not follow provider redirects while exchanging credentials', async () => {
    request.mockReturnValue(response(session, 302));
    await expect(client.execute('signin', {})).rejects.toMatchObject({
      status: 503,
    });
    expect(request.mock.calls[0][0].maxRedirects).toBe(0);
  });
});
