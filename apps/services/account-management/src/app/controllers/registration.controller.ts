import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import { CompleteRegistrationRequestDto } from './dto/complete-registration.request.dto';
import { PublicAccountAppService } from '../services/public-account-app.service';

@ApiTags('registration')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly svc: PublicAccountAppService) {}

  @Post('complete')
  @ApiOperation({ summary: 'Complete registration (fills internal account/profile)' })
  async complete(@AuthUser() user: AuthenticatedUser, @Body() body: CompleteRegistrationRequestDto) {
    return await this.svc.completeRegistration({ uid: user.userId, dto: body, email: user.userEmail });
  }
}

