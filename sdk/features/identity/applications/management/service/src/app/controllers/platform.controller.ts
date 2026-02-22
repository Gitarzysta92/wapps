import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  @Get()
  @ApiOperation({ summary: 'Platform manifest' })
  get() {
    return {
      id: 'account-management',
      name: 'Account Management',
      type: 'service',
      runtime: 'nest',
      environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      version: process.env.APP_VERSION,
      commitSha: process.env.COMMIT_SHA || process.env.GITHUB_SHA,
      builtAt: process.env.BUILT_AT,
      endpoints: {
        apiBase: '/api',
        docs: '/api/docs',
        openapiJson: '/api/docs-json',
        health: '/api/health',
        platform: '/api/platform',
      },
      tags: ['scope:platform', 'layer:identity-admin'],
    };
  }
}

