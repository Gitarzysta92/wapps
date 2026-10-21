import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalHealthMonitorsClient } from './portal-health-monitors.client';
import { PortalHealthMonitorsController } from './portal-health-monitors.controller';

@Module({
  imports: [HttpModule],
  controllers: [PortalHealthMonitorsController],
  providers: [TrustedPortalIdentityReader, PortalHealthMonitorsClient],
})
export class PortalHealthMonitorsModule {}
