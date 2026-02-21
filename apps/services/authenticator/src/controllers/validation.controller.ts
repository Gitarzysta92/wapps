import { Controller, Get, Headers, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IDENTITY_AUTH_SERVICE } from '../tokens';
import { AuthenticatorAuthService } from '../identity/authenticator-auth.service';

@Controller()
export class ValidationController {
  constructor(
    @Inject(IDENTITY_AUTH_SERVICE) private readonly identificationService: AuthenticatorAuthService,
    private readonly config: ConfigService
  ) {}

  @Get('/validate')
  async validateRequired(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const result = await this.identificationService.validateRequired(authorization);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error('❌ Token validation failed:', result.error.message);

      const code =
        result.error && typeof (result.error as { code?: string }).code === 'string'
          ? (result.error as unknown as { code: string }).code
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

    if (this.config.get<string>('INGRESS_AUTH_SECRET')) {
      res.setHeader('X-Ingress-Auth', this.config.get<string>('INGRESS_AUTH_SECRET'));
    }

    if (principal.claims) {
      res.setHeader('X-User-Claims', JSON.stringify(principal.claims));
    }

    // eslint-disable-next-line no-console
    console.log(`✅ Token validated for user: ${principal.uid}`);

    return res.status(200).json({
      authenticated: true,
      uid: principal.uid,
    });
  }

  @Get('/validate-optional')
  async validateOptional(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const result = await this.identificationService.validateOptional(authorization);

    if (!result.ok || result.value.authenticated !== true) {
      res.setHeader('X-Anonymous', 'true');
      if (this.config.get<string>('INGRESS_AUTH_SECRET')) {
        res.setHeader('X-Ingress-Auth', this.config.get<string>('INGRESS_AUTH_SECRET'));
      }
      return res.status(200).json({ authenticated: false, anonymous: true });
    }

    const principal = result.value.principal;
    res.setHeader('X-User-Id', principal.uid);
    res.setHeader('X-User-Email', principal.email || '');

    if (this.config.get<string>('INGRESS_AUTH_SECRET')) {
      res.setHeader('X-Ingress-Auth', this.config.get<string>('INGRESS_AUTH_SECRET'));
    }

    return res.status(200).json({
      authenticated: true,
      uid: principal.uid,
    });
  }
}

