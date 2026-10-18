import { PortalPreferencesClient } from '../preferences/portal-preferences.client';
import { PortalContentPreferences } from '../preferences/portal-content-preferences';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalMemberClient } from './portal-member.client';
import { PortalMemberController } from './portal-member.controller';
import { PortalFavoriteContentService } from './portal-favorite-content.service';

@Module({
  imports: [HttpModule],
  controllers: [PortalMemberController],
  providers: [
    PortalPreferencesClient,
    PortalContentPreferences,
    TrustedPortalIdentityReader,
    PortalMemberClient,
    PortalFavoriteContentService,
  ],
})
export class PortalMemberModule {}
