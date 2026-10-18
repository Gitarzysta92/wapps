import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CatalogReadiness } from './catalog-readiness';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: CatalogReadiness) {}
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the service',
  })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return {
      status: 'ok',
      service: 'catalog-bff',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Returns the readiness status of the service',
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  async ready() {
    const report = await this.readiness.check();
    if (report.status !== 'ready')
      throw new ServiceUnavailableException(report);
    return report;
  }
}
