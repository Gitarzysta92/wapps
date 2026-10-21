import { PortalPreferencesClient } from '../preferences/portal-preferences.client';
import { PortalContentPreferences } from '../preferences/portal-content-preferences';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalProfilesClient } from './portal-profiles.client';
import { PortalProfilesTransport } from './portal-profiles.transport';
import {
  PortalPublicProfilesController,
  PortalProfileRelationsController,
  PortalProfileBadgeController,
} from './portal-profiles.controller';

@Module({
  imports: [HttpModule],
  controllers: [
    PortalPublicProfilesController,
    PortalProfileRelationsController,
    PortalProfileBadgeController,
  ],
  providers: [
    PortalPreferencesClient,
    PortalContentPreferences,
    TrustedPortalIdentityReader,
    PortalProfilesClient,
    PortalProfilesTransport,
  ],
})
export class PortalProfilesModule {}
