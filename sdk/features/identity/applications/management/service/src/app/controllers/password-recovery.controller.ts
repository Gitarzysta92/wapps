import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PasswordRecoveryRequestDto } from './dto/password-recovery.request.dto';
import { PublicAccountAppService } from '../services/public-account-app.service';

@ApiTags('password-recovery')
@Controller('password-recovery')
export class PasswordRecoveryController {
  constructor(private readonly svc: PublicAccountAppService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Start password recovery',
    description:
      'Requests provider email delivery. Unknown email addresses receive the same acknowledgement. Provider outages return an error.',
  })
  async start(@Body() body: PasswordRecoveryRequestDto) {
    return await this.svc.startPasswordRecovery(body);
  }
}
