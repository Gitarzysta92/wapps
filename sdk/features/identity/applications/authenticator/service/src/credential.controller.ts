import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  credentialOperations,
  credentialRequest,
  type CredentialOperation,
  CredentialRegistrationRejected,
  IdentityAuthenticationUnavailable,
  EmailVerificationRejected,
  EmailVerificationThrottled,
  PasswordResetRejected,
} from '@sdk/features/identity/libs/authentication';
import {
  CredentialInputError,
  CredentialUnavailable,
  PasswordRecoveryUnavailable,
} from '@sdk/features/identity/libs/management';
import { AccountExportCaptureSequence } from '@sdk/features/identity/core';
import {
  CREDENTIAL_ADAPTERS,
  CredentialAdapters,
} from './credential-providers';
import type { Result } from '@sdk/kernel/standard';

@Controller('credentials')
export class CredentialController {
  constructor(
    @Inject(CREDENTIAL_ADAPTERS) private readonly adapters: CredentialAdapters,
    private readonly config: ConfigService
  ) {}

  @Post(':operation')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async execute(
    @Param('operation') operation: CredentialOperation,
    @Body() input: unknown,
    @Req() request: Request
  ) {
    const expected = this.config.getOrThrow<string>('AUTH_SERVICE_SECRET');
    const provided = request.headers['x-credential-service'];
    if (
      typeof provided !== 'string' ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(provided) ||
      provided.length !== expected.length ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected)) ||
      request.rawHeaders.filter(
        (value, index) =>
          index % 2 === 0 && value.toLowerCase() === 'x-credential-service'
      ).length !== 1 ||
      Object.keys(request.headers).some(
        (key) =>
          key === 'authorization' ||
          key.startsWith('x-user-') ||
          key === 'x-ingress-auth'
      )
    )
      throw new HttpException({ error: 'unauthorized' }, 401);
    if (
      !credentialOperations.includes(operation) ||
      Object.keys(request.query).length
    )
      throw new HttpException({ error: 'invalid-request' }, 400);
    let body: Record<string, unknown>;
    try {
      body = credentialRequest(operation, input);
    } catch {
      throw new HttpException({ error: 'invalid-request' }, 400);
    }
    try {
      const value = await this.run(operation, body);
      return {
        issuer: this.config.getOrThrow<string>('AUTH_ISSUER'),
        ...(body['subject'] === undefined ? {} : { subject: body['subject'] }),
        value,
      };
    } catch (error) {
      const status =
        error instanceof EmailVerificationThrottled
          ? 429
          : error instanceof CredentialInputError ||
            error instanceof PasswordResetRejected ||
            error instanceof EmailVerificationRejected
          ? 400
          : error instanceof CredentialRegistrationRejected
          ? 401
          : 503;
      throw new HttpException(
        {
          issuer: this.config.getOrThrow<string>('AUTH_ISSUER'),
          error:
            status === 503
              ? 'unavailable'
              : status === 429
              ? 'throttled'
              : 'rejected',
        },
        status
      );
    }
  }

  private value<T>(result: Result<T, Error>): T {
    if (result.ok) return result.value;
    if (
      result.error instanceof IdentityAuthenticationUnavailable ||
      result.error instanceof CredentialUnavailable ||
      result.error instanceof CredentialInputError ||
      result.error instanceof PasswordRecoveryUnavailable
    )
      throw result.error;
    throw new CredentialRegistrationRejected('Credential request rejected');
  }

  private async run(
    operation: CredentialOperation,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const text = (key: string) => body[key] as string;
    const subject = text('subject');
    const adapter = this.adapters;
    switch (operation) {
      case 'password-session':
      case 'registration':
      case 'refresh': {
        const session = this.value(
          await (operation === 'refresh'
            ? adapter.sessions.refresh(text('refreshToken'))
            : operation === 'registration'
            ? adapter.sessions.registerOrAuthenticate(
                text('email'),
                text('password'),
                text('key')
              )
            : adapter.sessions.signInWithPassword(
                text('email'),
                text('password')
              ))
        );
        const principal = this.value(
          await adapter.verifier.verifyIdToken(session.token)
        );
        if (principal.uid !== session.uid)
          throw new Error('Inconsistent session');
        return {
          subject: session.uid,
          token: session.token,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
          ...(operation === 'registration'
            ? {
                enrollmentEligible:
                  'enrollmentEligible' in session &&
                  session.enrollmentEligible === true,
              }
            : {}),
        };
      }
      case 'verify-token': {
        const { uid, ...principal } = this.value(
          await adapter.verifier.verifyIdToken(text('token'))
        );
        return { ...principal, subject: uid };
      }
      case 'revoke':
        return this.confirm(
          this.value(await adapter.admin.revokeRefreshTokens(subject))
        );
      case 'delete':
        return this.confirm(
          this.value(await adapter.admin.deleteUser(subject))
        );
      case 'update':
        return this.confirm(
          this.value(
            await adapter.admin.updateUser(
              subject,
              body['patch'] as Parameters<typeof adapter.admin.updateUser>[1]
            )
          )
        );
      case 'password-reset-link':
        return {
          link: this.value(
            await adapter.admin.generatePasswordResetLink(
              subject,
              text('email')
            )
          ),
        };
      case 'email-verification-link':
        return {
          link: this.value(
            await adapter.admin.generateEmailVerificationLink(
              subject,
              text('email')
            )
          ),
        };
      case 'password-recovery':
        await adapter.recovery.send(text('email'));
        return { confirmed: true };
      case 'password-reset-verify':
        await adapter.reset.verify(text('code'));
        return { confirmed: true };
      case 'password-reset-complete':
        await adapter.reset.complete(text('code'), text('password'));
        return { confirmed: true };
      case 'email-verify':
        await adapter.email.verify(text('code'));
        return { confirmed: true };
      case 'email-complete':
        await adapter.email.complete(text('code'));
        return { confirmed: true };
      case 'email-status':
      case 'email-request': {
        const token = text('token');
        if (
          this.value(await adapter.verifier.verifyIdToken(token)).uid !==
          subject
        )
          throw new CredentialRegistrationRejected(
            'Credential subject mismatch'
          );
        return operation === 'email-status'
          ? adapter.email.status({ uid: subject, token })
          : { outcome: await adapter.email.request({ uid: subject, token }) };
      }
      case 'export': {
        const sequence = new AccountExportCaptureSequence(adapter.exports.name);
        const entries = [];
        let size = 0;
        for await (const raw of adapter.exports.capture(
          subject,
          AbortSignal.timeout(10000)
        )) {
          const entry = sequence.accept(raw);
          size += Buffer.byteLength(JSON.stringify(entry));
          if (entries.length >= 64 || size > 192 * 1024)
            throw new Error('Credential export exceeds bounds');
          entries.push(entry);
        }
        sequence.finish();
        return { entries };
      }
    }
  }

  private confirm(value: boolean): { confirmed: true } {
    if (value !== true) throw new Error('Credential operation unconfirmed');
    return { confirmed: true };
  }
}
