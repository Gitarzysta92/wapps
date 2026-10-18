import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalArticleRequest } from './portal-articles.request';
import { PortalArticlesTransport } from './portal-articles.transport';
import { PortalArticlesClient } from './portal-articles.client';
import { PortalArticleCoversClient } from './portal-article-covers.client';
import { PortalArticleCoversController } from './portal-article-covers.controller';
import { PortalArticlesController } from './portal-articles.controller';

@Module({
  imports: [HttpModule],
  controllers: [PortalArticlesController, PortalArticleCoversController],
  providers: [
    TrustedPortalIdentityReader,
    PortalArticleRequest,
    PortalArticlesTransport,
    PortalArticlesClient,
    PortalArticleCoversClient,
  ],
})
export class PortalArticlesModule {}
