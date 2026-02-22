import { Controller, Get } from '@nestjs/common';

@Controller()
export class PlatformController {
  @Get('/api/platform')
  platform(): object {
    return {
      id: 'authenticator',
      name: 'Authenticator',
      type: 'service',
      runtime: 'express',
      environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      version: process.env.APP_VERSION,
      commitSha: process.env.COMMIT_SHA || process.env.GITHUB_SHA,
      builtAt: process.env.BUILT_AT,
      endpoints: {
        health: '/health',
        docs: '/api-docs',
        openapiJson: '/api-docs.json',
        platform: '/api/platform',
      },
      tags: ['scope:platform', 'layer:auth'],
    };
  }
}

