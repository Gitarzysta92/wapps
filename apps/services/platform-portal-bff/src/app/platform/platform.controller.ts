import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

type PlatformManifest = {
  id: string;
  name: string;
  type: 'service';
  runtime: 'nest';
  environment: string;
  version?: string;
  commitSha?: string;
  builtAt?: string;
  endpoints: Record<string, string>;
};

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  @Get()
  @ApiOperation({ summary: 'Platform manifest for this service' })
  get(): PlatformManifest {
    return {
      id: 'platform-portal-bff',
      name: 'Platform Portal BFF',
      type: 'service',
      runtime: 'nest',
      environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      version: process.env.APP_VERSION,
      commitSha: process.env.COMMIT_SHA || process.env.GITHUB_SHA,
      builtAt: process.env.BUILT_AT,
      endpoints: {
        health: '/api/health',
        ready: '/api/health/ready',
        docs: '/api/docs',
        openapiJson: '/api/docs-json',
        services: '/api/services',
        platform: '/api/platform',
      },
    };
  }
}

