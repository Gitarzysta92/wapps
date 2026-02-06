import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PlatformController } from './platform/platform.controller';
import { ServicesController } from './services/services.controller';
import { ServicesService } from './services/services.service';
import { KubernetesDiscoveryService } from './services/kubernetes-discovery.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [HealthController, PlatformController, ServicesController],
  providers: [ServicesService, KubernetesDiscoveryService],
})
export class AppModule {}

