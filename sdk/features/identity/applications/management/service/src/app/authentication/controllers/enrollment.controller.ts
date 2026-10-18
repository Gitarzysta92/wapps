import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  HttpException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CredentialPasswordResetService,
  CredentialRegistrationRejected,
  CredentialRegistrationService,
  PasswordResetRejected,
} from '@sdk/features/identity/libs/authentication';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import { Result } from '@sdk/kernel/standard';
import { RegisterDto } from './models/register.dto';
import {
  ResetPasswordDto,
  VerifyPasswordResetDto,
} from './models/reset-password.dto';

@Controller('auth')
export class EnrollmentController {
  constructor(
    private readonly registration: CredentialRegistrationService,
    private readonly reset: CredentialPasswordResetService,
    private readonly config: ConfigService
  ) {}

  @Post('register')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async register(
    @Body() body: RegisterDto,
    @Headers('idempotency-key') key: string
  ) {
    this.enabled();
    return this.value(await this.registration.register(body, key));
  }

  @Post('password-reset/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async verify(@Body() body: VerifyPasswordResetDto) {
    this.enabled();
    this.value(await this.reset.verify(body.code));
    return { valid: true };
  }

  @Post('password-reset/complete')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async complete(@Body() body: ResetPasswordDto) {
    this.enabled();
    this.value(await this.reset.complete(body));
    return { completed: true };
  }

  private enabled(): void {
    if (this.config.get<string>('ENABLE_EMAIL_PASSWORD') === 'false')
      throw new ForbiddenException('Email/password authentication is disabled');
  }

  private value<T>(result: Result<T, Error>): T {
    if (result.ok) return result.value;
    const error = result.error;
    const status =
      error instanceof CanonicalIdentityAccessDenied
        ? 403
        : error instanceof CanonicalIdentityConflict
        ? 409
        : error instanceof CanonicalIdentityInputError ||
          error instanceof CredentialRegistrationRejected ||
          error instanceof PasswordResetRejected
        ? 400
        : 503;
    throw new HttpException(
      {
        error:
          status === 503
            ? 'Identity service unavailable. Try again or sign in if registration was interrupted.'
            : error.message,
      },
      status
    );
  }
}
