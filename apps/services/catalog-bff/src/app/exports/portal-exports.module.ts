import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalExportsClient } from './portal-exports.client';
import { PortalExportsController } from './portal-exports.controller';
import { PortalExportDownloads } from './portal-exports.download';

@Module({
  imports: [HttpModule],
  controllers: [PortalExportsController],
  providers: [
    TrustedPortalIdentityReader,
    PortalExportsClient,
    PortalExportDownloads,
  ],
})
export class PortalExportsModule {}
