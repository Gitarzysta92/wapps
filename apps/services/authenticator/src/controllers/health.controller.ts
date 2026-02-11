import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/health')
  health(): { status: 'healthy' } {
    return { status: 'healthy' };
  }
}

