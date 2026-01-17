import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Platform, Device, Social, Store, MonetizationModel, UserSpan } from './entities/index';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';

@Module({
  imports: [TypeOrmModule.forFeature([Platform, Device, Social, Store, MonetizationModel, UserSpan])],
  controllers: [ReferenceController],
  providers: [ReferenceService],
  exports: [ReferenceService, TypeOrmModule],
})
export class ReferenceModule {}
