import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRecord } from './entities/app-record.entity';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppRecord])],
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
