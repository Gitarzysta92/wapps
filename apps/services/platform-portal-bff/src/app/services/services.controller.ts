import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List public services and their addresses',
    description:
      'Discovers public URLs from Kubernetes Ingress resources and enriches them using /api/platform or /.well-known/platform.json when available.',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    description: 'When true, bypass in-memory cache.',
  })
  async list(@Query('refresh') refresh?: string) {
    return await this.services.list({ refresh: refresh === 'true' });
  }
}

