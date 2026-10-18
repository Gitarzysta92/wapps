import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpException,
  Post,
} from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { CanonicalIdentityInputError } from '@sdk/features/identity/core';
import {
  CredentialEmailVerificationService,
  EmailVerificationAuthenticationRequired,
  EmailVerificationRejected,
  EmailVerificationThrottled,
} from '@sdk/features/identity/libs/authentication';
import { Result } from '@sdk/kernel/standard';

export class EmailVerificationCodeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,2048}$/)
  code!: string;
}

@Controller('auth/email-verification')
export class EmailVerificationController {
  constructor(
    private readonly verification: CredentialEmailVerificationService
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  async status(@Headers('authorization') authorization?: string) {
    return this.value(
      await this.verification.status(this.token(authorization))
    );
  }

  @Post('request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async request(@Headers('authorization') authorization?: string) {
    return {
      outcome: this.value(
        await this.verification.request(this.token(authorization))
      ),
    };
  }

  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async verify(@Body() body: EmailVerificationCodeDto) {
    this.value(await this.verification.verify(body.code));
    return { valid: true };
  }

  @Post('complete')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async complete(@Body() body: EmailVerificationCodeDto) {
    this.value(await this.verification.complete(body.code));
    return { completed: true };
  }

  private token(authorization?: string): string {
    return /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1] ?? '';
  }

  private value<T>(result: Result<T, Error>): T {
    if (result.ok) return result.value;
    const error = result.error;
    const status =
      error instanceof EmailVerificationAuthenticationRequired
        ? 401
        : error instanceof EmailVerificationThrottled
        ? 429
        : error instanceof EmailVerificationRejected ||
          error instanceof CanonicalIdentityInputError
        ? 400
        : 503;
    throw new HttpException(
      {
        error:
          status === 503
            ? 'Email verification could not be confirmed. Refresh your status in Profile Settings before requesting another link.'
            : error.message,
      },
      status
    );
  }
}
