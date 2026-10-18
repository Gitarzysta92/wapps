import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalAccountClient } from './portal-account.client';
import { PortalAccountController } from './portal-account.controller';
import { PortalAccountAdminController } from './portal-account-admin.controller';
import { PortalAccountAdminClient } from './portal-account-admin.client';

@Module({
  imports: [HttpModule],
  controllers: [PortalAccountController, PortalAccountAdminController],
  providers: [
    TrustedPortalIdentityReader,
    PortalAccountClient,
    PortalAccountAdminClient,
  ],
})
export class PortalAccountModule {}
