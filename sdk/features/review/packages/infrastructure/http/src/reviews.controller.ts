import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ReviewDeniedError,
  type ReviewChange,
} from '@sdk/features/review/core';
import {
  REVIEW_HTTP_OPTIONS,
  type ReviewHttpOptions,
} from './review-http.options';
import { reviewCommandKey, reviewQuery } from './review-http.input';
import { ReviewHttpFilter } from './review-http.filter';

@Controller('reviews')
@UseFilters(ReviewHttpFilter)
export class ReviewsController {
  constructor(
    @Inject(REVIEW_HTTP_OPTIONS) private readonly options: ReviewHttpOptions
  ) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(@Req() request: Request) {
    const { bindingKey } = reviewQuery(request);
    return this.options.reviews.summary(
      bindingKey,
      this.options.actor(request, false)
    );
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  page(@Req() request: Request) {
    const { bindingKey, cursor } = reviewQuery(request, true);
    return this.options.reviews.page(
      bindingKey,
      this.options.actor(request, false),
      cursor
    );
  }

  @Get('moderation')
  @Header('Cache-Control', 'no-store')
  moderation(@Req() request: Request) {
    const { bindingKey, cursor } = reviewQuery(request, true);
    return this.options.reviews.page(
      bindingKey,
      this.actor(request),
      cursor,
      true
    );
  }

  @Get(':id/reports')
  @Header('Cache-Control', 'no-store')
  reports(@Req() request: Request, @Param('id') id: string) {
    const { bindingKey, cursor } = reviewQuery(request, true);
    return this.options.reviews.reports(
      bindingKey,
      id,
      this.actor(request),
      cursor
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@Req() request: Request, @Param('id') id: string) {
    const { bindingKey } = reviewQuery(request);
    return this.options.reviews.read(
      bindingKey,
      id,
      this.options.actor(request, false)
    );
  }

  @Put('mine')
  @Header('Cache-Control', 'no-store')
  publish(@Req() request: Request, @Body() body: unknown) {
    return this.change(request, null, 'publish', body);
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  withdraw(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'withdraw', body);
  }

  @Put(':id/helpful')
  @Header('Cache-Control', 'no-store')
  helpful(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'helpful', body);
  }

  @Post(':id/reports')
  @Header('Cache-Control', 'no-store')
  report(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'report', body);
  }

  @Put(':id/moderation')
  @Header('Cache-Control', 'no-store')
  moderate(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'moderate', body);
  }

  private actor(request: Request) {
    const actor = this.options.actor(request, true);
    if (!actor)
      throw new ReviewDeniedError('Authenticated review actor required');
    return actor;
  }

  private change(
    request: Request,
    id: string | null,
    type: ReviewChange['type'],
    body: unknown
  ) {
    const { bindingKey } = reviewQuery(request);
    return this.options.reviews.change(
      bindingKey,
      id,
      type,
      body,
      this.actor(request),
      reviewCommandKey(request)
    );
  }
}
