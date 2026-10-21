import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EditorialReadiness } from './editorial-readiness';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: EditorialReadiness) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'editorial',
    };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    const report = await this.readiness.check();
    if (report.status !== 'ready')
      throw new ServiceUnavailableException(report);
    return report;
  }
}
