import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { CanonicalIdentityInputError } from '@sdk/features/identity/core';
import { DiscussionMentionRecipients } from '@sdk/features/identity/libs/management';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';

@Controller('internal/mention-recipients')
export class DiscussionMentionRecipientsController {
  constructor(private readonly mentions: DiscussionMentionRecipients) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  async resolve(
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @AuthUser() user: AuthenticatedUser
  ) {
    if (Object.keys(query).length)
      throw new CanonicalIdentityInputError(
        'Mention resolution accepts no query'
      );
    const roles = user.userClaims?.['roles'],
      tenant = user.userClaims?.['tenantId'];
    const result = await this.mentions.resolve(body, {
      identityId: user.userId,
      tenantId: typeof tenant === 'string' ? tenant : undefined,
      timestamp: Date.now(),
      subject: { roles: Array.isArray(roles) ? roles : [] },
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
