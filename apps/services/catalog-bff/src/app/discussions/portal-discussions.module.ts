import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalDiscussionRequest } from './portal-discussions.request';
import { PortalDiscussionsTransport } from './portal-discussions.transport';
import { PortalDiscussionsClient } from './portal-discussions.client';
import { PortalDiscussionsController } from './portal-discussions.controller';
import { PortalArticleCommentsController } from './portal-article-comments.controller';
import { PortalArticleCommentsClient } from './portal-article-comments.client';
import { PortalGenericDiscussionsController } from './portal-generic-discussions.controller';
import { PortalGenericDiscussionsClient } from './portal-generic-discussions.client';

@Module({
  imports: [HttpModule],
  controllers: [
    PortalDiscussionsController,
    PortalArticleCommentsController,
    PortalGenericDiscussionsController,
  ],
  providers: [
    TrustedPortalIdentityReader,
    PortalDiscussionRequest,
    PortalDiscussionsTransport,
    PortalDiscussionsClient,
    PortalArticleCommentsClient,
    PortalGenericDiscussionsClient,
  ],
})
export class PortalDiscussionsModule {}
