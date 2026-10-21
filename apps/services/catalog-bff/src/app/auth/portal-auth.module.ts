import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PortalAuthClient } from './portal-auth.client';
import {
  PortalAuthController,
  PortalPasswordRecoveryController,
} from './portal-auth.controller';

@Module({
  imports: [HttpModule],
  providers: [PortalAuthClient],
  controllers: [PortalAuthController, PortalPasswordRecoveryController],
})
export class PortalAuthModule {}
