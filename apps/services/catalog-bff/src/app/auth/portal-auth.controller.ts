import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  Post,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { singleHeader } from '../identity/trusted-portal-identity';
import {
  PortalAuthClient,
  type PortalAuthOperation,
} from './portal-auth.client';

@Catch()
export class PortalAuthErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'no-store');
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      error:
        error instanceof HttpException
          ? error.message
          : 'Authentication action could not be confirmed',
    });
  }
}

function input(
  request: Request,
  fields: Record<string, number>
): Record<string, string> {
  if (Object.keys(request.query).length)
    throw new BadRequestException('Unexpected authentication query');
  const body: unknown = request.body ?? {};
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Invalid authentication request');
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some((key) => !(key in fields)))
    throw new BadRequestException('Unexpected authentication field');
  const result: Record<string, string> = {};
  for (const [key, maximum] of Object.entries(fields)) {
    const value = data[key];
    if (typeof value !== 'string' || !value.length || value.length > maximum)
      throw new BadRequestException(`Invalid ${key}`);
    result[key] = value;
  }
  return result;
}
function authorization(request: Request): Record<string, string> {
  const value = singleHeader(request, 'authorization', 16400);
  if (!value || !/^Bearer\s+\S{1,16384}$/i.test(value))
    throw new HttpException('Sign in again', 401);
  return { Authorization: value };
}

@Controller('auth')
@UseFilters(PortalAuthErrorFilter)
export class PortalAuthController {
  constructor(private readonly auth: PortalAuthClient) {}

  @Post('signin')
  signIn(@Req() req: Request, @Res() res: Response) {
    return this.run(res, 'signin', input(req, { email: 254, password: 128 }));
  }
  @Post('register')
  register(@Req() req: Request, @Res() res: Response) {
    const body = input(req, {
      email: 254,
      password: 128,
      passwordConfirmation: 128,
      nickname: 120,
    });
    const key = singleHeader(req, 'idempotency-key', 128);
    if (!key || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return this.run(res, 'register', body, { 'Idempotency-Key': key });
  }
  @Post('refresh')
  refresh(@Req() req: Request, @Res() res: Response) {
    return this.run(res, 'refresh', input(req, { refreshToken: 16384 }));
  }
  @Post('signout')
  signOut(@Req() req: Request, @Res() res: Response) {
    return this.run(res, 'signout', input(req, {}), authorization(req));
  }
  @Get('methods')
  methods(@Req() req: Request, @Res() res: Response) {
    input(req, {});
    return this.run(res, 'methods');
  }
  @Post('signin/anonymous')
  anonymous(@Req() req: Request, @Res() res: Response) {
    return this.run(res, 'signin/anonymous', input(req, {}));
  }
  @Post('signin/oauth')
  oauth(@Req() req: Request, @Res() res: Response) {
    const hasVerifier =
      req.body &&
      Object.prototype.hasOwnProperty.call(req.body, 'codeVerifier');
    const fields: Record<string, number> = {
      provider: 16,
      code: 4096,
      redirectUri: 2048,
    };
    if (hasVerifier) fields['codeVerifier'] = 128;
    const body = input(req, fields);
    if (!['google', 'github'].includes(body['provider'].toLowerCase()))
      throw new BadRequestException('Unknown authentication provider');
    return this.run(res, 'signin/oauth', body);
  }
  @Get('oauth/google/authorize')
  google(@Req() req: Request, @Res() res: Response) {
    return this.redirect('google', req, res);
  }
  @Get('oauth/github/authorize')
  github(@Req() req: Request, @Res() res: Response) {
    return this.redirect('github', req, res);
  }
  @Get('email-verification/status')
  emailStatus(@Req() req: Request, @Res() res: Response) {
    input(req, {});
    return this.run(
      res,
      'email-verification/status',
      undefined,
      authorization(req)
    );
  }
  @Post('email-verification/request')
  emailRequest(@Req() req: Request, @Res() res: Response) {
    return this.run(
      res,
      'email-verification/request',
      input(req, {}),
      authorization(req)
    );
  }
  @Post('email-verification/verify')
  emailVerify(@Req() req: Request, @Res() res: Response) {
    return this.run(
      res,
      'email-verification/verify',
      input(req, { code: 2048 })
    );
  }
  @Post('email-verification/complete')
  emailComplete(@Req() req: Request, @Res() res: Response) {
    return this.run(
      res,
      'email-verification/complete',
      input(req, { code: 2048 })
    );
  }
  @Post('password-reset/verify')
  resetVerify(@Req() req: Request, @Res() res: Response) {
    return this.run(res, 'password-reset/verify', input(req, { code: 2048 }));
  }
  @Post('password-reset/complete')
  resetComplete(@Req() req: Request, @Res() res: Response) {
    return this.run(
      res,
      'password-reset/complete',
      input(req, { code: 2048, password: 128, passwordConfirmation: 128 })
    );
  }

  private async run(
    res: Response,
    operation: PortalAuthOperation,
    body?: unknown,
    headers?: Record<string, string>
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(200)
      .json(await this.auth.execute(operation, body, headers));
  }
  private async redirect(
    provider: 'google' | 'github',
    req: Request,
    res: Response
  ) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (
        ![
          'redirect_uri',
          'state',
          'code_challenge',
          'code_challenge_method',
        ].includes(key) ||
        typeof value !== 'string' ||
        !value ||
        value.length > 2048
      )
        throw new BadRequestException('Invalid authorization query');
      query.set(key, value);
    }
    if (!query.has('redirect_uri'))
      throw new BadRequestException('redirect_uri is required');
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(await this.auth.authorize(provider, query));
  }
}

@Controller('password-recovery')
@UseFilters(PortalAuthErrorFilter)
export class PortalPasswordRecoveryController {
  constructor(private readonly auth: PortalAuthClient) {}
  @Post()
  async recover(@Req() req: Request, @Res() res: Response) {
    const body = input(req, { email: 254 });
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(202)
      .json(await this.auth.recovery({ email: body['email'] }));
  }
}
