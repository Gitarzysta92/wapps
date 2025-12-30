import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { EditorialClient } from './clients/editorial.client';

@Module({
  imports: [HttpModule],
  controllers: [CatalogController],
  providers: [CatalogService, EditorialClient],
})
export class CatalogModule {}

