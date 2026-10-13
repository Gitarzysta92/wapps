import { Controller, Get, Headers, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { TokenValidationService } from '../services/token-validation.service';
import { IdentityAuthenticationUnavailable } from '@sdk/features/identity/libs/authentication';

@Controller()
export class ValidationController {
  constructor(
    private readonly identificationService: TokenValidationService,
    private readonly config: ConfigService
  ) {}

  @Get('/validate')
  async validateRequired(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response
  ) {
    const result = await this.identificationService.validateRequired(
      authorization
    );
    if (!result.ok) {
      console.error('❌ Token validation failed:', result.error.message);

      const code =
        'code' in result.error && typeof result.error.code === 'string'
          ? result.error.code
          : undefined;

      if (code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Token expired' });
      }

      if (code === 'auth/argument-error') {
        return res.status(401).json({ error: 'Invalid token format' });
      }

      return res.status(401).json({ error: 'Token validation failed' });
    }

    const principal = result.value;

    res.setHeader('X-User-Id', principal.uid);
    res.setHeader('X-User-Email', principal.email || '');
    res.setHeader('X-Auth-Time', principal.authTime?.toString() || '');

    this.setIngressSecret(res);

    if (principal.claims) {
      res.setHeader('X-User-Claims', JSON.stringify(principal.claims));
    }

    console.log(`✅ Token validated for user: ${principal.uid}`);

    return res.status(200).json({
      authenticated: true,
      uid: principal.uid,
    });
  }

  @Get('/validate-optional')
  async validateOptional(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response
  ) {
    const result = await this.identificationService.validateOptional(
      authorization
    );

    if (!result.ok) {
      return res
        .status(
          result.error instanceof IdentityAuthenticationUnavailable ? 503 : 401
        )
        .json({ error: 'Identity validation failed' });
    }

    if (result.value.authenticated !== true) {
      res.setHeader('X-Anonymous', 'true');
      this.setIngressSecret(res);
      return res.status(200).json({ authenticated: false, anonymous: true });
    }

    const principal = result.value.principal;
    res.setHeader('X-User-Id', principal.uid);
    res.setHeader('X-User-Email', principal.email || '');
    res.setHeader('X-Auth-Time', principal.authTime?.toString() || '');
    if (principal.claims) {
      res.setHeader('X-User-Claims', JSON.stringify(principal.claims));
    }

    this.setIngressSecret(res);

    return res.status(200).json({
      authenticated: true,
      uid: principal.uid,
    });
  }

  private setIngressSecret(res: Response): void {
    const secret = this.config.get<string>('INGRESS_AUTH_SECRET');
    if (secret) res.setHeader('X-Ingress-Auth', secret);
  }
}
