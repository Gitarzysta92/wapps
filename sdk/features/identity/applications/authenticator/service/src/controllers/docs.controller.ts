import { Controller, Get, Inject } from '@nestjs/common';
import { SWAGGER_DOCUMENT } from '../tokens';

@Controller()
export class DocsController {
  constructor(@Inject(SWAGGER_DOCUMENT) private readonly swagger: object) {}

  @Get('/api-docs.json')
  getOpenApiJson(): object {
    return this.swagger;
  }
}

