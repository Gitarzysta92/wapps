import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request } from 'express';
import { reviewId, type ReviewChange } from '@sdk/features/review/core';
import {
  PortalReviewErrorFilter,
  PortalReviewRequest,
  reviewRequest,
} from './portal-reviews.request';
import { PortalReviewsClient } from './portal-reviews.client';

@Controller('application-reviews/:applicationId')
@UseFilters(PortalReviewErrorFilter)
export class PortalReviewsController {
  constructor(
    private readonly requests: PortalReviewRequest,
    private readonly reviews: PortalReviewsClient
  ) {}
  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  summary(
    @Req() request: Request,
    @Param('applicationId') applicationId: string
  ) {
    const actor = this.requests.viewer(request);
    return this.reviews.summary(
      actor,
      reviewRequest(() => reviewId(applicationId))
    );
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  page(@Req() request: Request, @Param('applicationId') applicationId: string) {
    const actor = this.requests.viewer(request, ['cursor']);
    return this.reviews.page(
      actor,
      reviewRequest(() => reviewId(applicationId)),
      request.query.cursor
    );
  }
  @Get('moderation')
  @Header('Cache-Control', 'private, no-store')
  moderation(
    @Req() request: Request,
    @Param('applicationId') applicationId: string
  ) {
    const actor = this.requests.actor(request, ['cursor']);
    return this.reviews.page(
      actor,
      reviewRequest(() => reviewId(applicationId)),
      request.query.cursor,
      true
    );
  }
  @Put('mine')
  @Header('Cache-Control', 'private, no-store')
  publish(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, null, 'publish', body);
  }
  @Get(':id/reports')
  @Header('Cache-Control', 'private, no-store')
  reports(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string
  ) {
    const actor = this.requests.actor(request, ['cursor']);
    return this.reviews.reports(
      actor,
      reviewRequest(() => reviewId(applicationId)),
      reviewRequest(() => reviewId(id)),
      request.query.cursor
    );
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  read(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string
  ) {
    const actor = this.requests.viewer(request);
    return this.reviews.read(
      actor,
      reviewRequest(() => reviewId(applicationId)),
      reviewRequest(() => reviewId(id))
    );
  }
  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  withdraw(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'withdraw', body);
  }
  @Put(':id/helpful')
  @Header('Cache-Control', 'private, no-store')
  helpful(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'helpful', body);
  }
  @Post(':id/reports')
  @Header('Cache-Control', 'private, no-store')
  report(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'report', body);
  }
  @Put(':id/moderation')
  @Header('Cache-Control', 'private, no-store')
  moderate(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'moderate', body);
  }
  private change(
    request: Request,
    applicationId: string,
    id: string | null,
    type: ReviewChange['type'],
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.reviews.change(
      actor,
      reviewRequest(() => reviewId(applicationId)),
      id === null ? null : reviewRequest(() => reviewId(id)),
      type,
      body,
      this.requests.key(request)
    );
  }
}
