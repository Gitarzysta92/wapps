import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PasswordRecoveryRequestDto } from './dto/password-recovery.request.dto';
import { PublicAccountAppService } from '../services/public-account-app.service';

@ApiTags('password-recovery')
@Controller('password-recovery')
export class PasswordRecoveryController {
  constructor(private readonly svc: PublicAccountAppService) {}

  @Post()
  @ApiOperation({
    summary: 'Start password recovery',
    description:
      'Always returns ok=true to avoid account enumeration. By default does not return the reset link unless EXPOSE_PASSWORD_RESET_LINK=true.',
  })
  async start(@Body() body: PasswordRecoveryRequestDto) {
    return await this.svc.startPasswordRecovery(body);
  }
}

