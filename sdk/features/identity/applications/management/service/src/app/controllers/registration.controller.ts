import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import { CompleteRegistrationRequestDto } from './dto/complete-registration.request.dto';
import { PublicAccountAppService } from '../services/public-account-app.service';

@ApiTags('registration')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly svc: PublicAccountAppService) {}

  @Post('complete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Complete registration (fills internal account/profile)',
  })
  async complete(
    @AuthUser() user: AuthenticatedUser,
    @Body() body: CompleteRegistrationRequestDto,
    @Headers('idempotency-key') key: string
  ) {
    if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return await this.svc.completeRegistration({
      uid: user.userId,
      dto: body,
      key,
    });
  }
}
