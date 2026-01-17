import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReferenceService } from './reference.service';

@ApiTags('reference')
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('platforms')
  @ApiOperation({ summary: 'Get all platforms' })
  getPlatforms() {
    return this.referenceService.getPlatforms();
  }

  @Get('devices')
  @ApiOperation({ summary: 'Get all devices' })
  getDevices() {
    return this.referenceService.getDevices();
  }

  @Get('socials')
  @ApiOperation({ summary: 'Get all socials' })
  getSocials() {
    return this.referenceService.getSocials();
  }

  @Get('stores')
  @ApiOperation({ summary: 'Get all stores' })
  getStores() {
    return this.referenceService.getStores();
  }

  @Get('monetization-models')
  @ApiOperation({ summary: 'Get all monetization models' })
  getMonetizationModels() {
    return this.referenceService.getMonetizationModels();
  }

  @Get('user-spans')
  @ApiOperation({ summary: 'Get all user spans' })
  getUserSpans() {
    return this.referenceService.getUserSpans();
  }
}
