import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalPreferencesClient } from './portal-preferences.client';
import { PortalPreferencesController } from './portal-preferences.controller';

@Module({
  imports: [HttpModule],
  controllers: [PortalPreferencesController],
  providers: [TrustedPortalIdentityReader, PortalPreferencesClient],
})
export class PortalPreferencesModule {}
