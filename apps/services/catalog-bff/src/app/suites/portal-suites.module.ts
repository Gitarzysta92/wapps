import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalSuitesClient } from './portal-suites.client';
import { PortalSuitesController } from './portal-suites.controller';
import { PortalSuitePublicationClient } from './portal-suite-publication.client';
import { PortalSuitePublicationController } from './portal-suite-publication.controller';

@Module({
  imports: [HttpModule],
  controllers: [PortalSuitesController, PortalSuitePublicationController],
  providers: [
    TrustedPortalIdentityReader,
    PortalSuitesClient,
    PortalSuitePublicationClient,
  ],
})
export class PortalSuitesModule {}
