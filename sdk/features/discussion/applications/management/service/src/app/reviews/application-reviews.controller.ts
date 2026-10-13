import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import {
  discussionActor,
  requiredActor,
} from '../discussions/discussions.controller';
import { ApplicationReviews } from './application/application-reviews';
import { ReviewErrorFilter } from './review-error.filter';

@Controller('application-reviews/:applicationId')
@UseFilters(ReviewErrorFilter)
export class ApplicationReviewsController {
  constructor(private readonly reviews: ApplicationReviews) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(
    @Param('applicationId') applicationId: string,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.reviews.summary(applicationId, discussionActor(user));
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  page(
    @Param('applicationId') applicationId: string,
    @Query('cursor') cursor: string | undefined,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.reviews.page(
      applicationId,
      discussionActor(user),
      cursor ?? null
    );
  }

  @Get('moderation')
  @Header('Cache-Control', 'no-store')
  moderation(
    @Param('applicationId') applicationId: string,
    @Query('cursor') cursor: string | undefined,
    @AuthUser() user: AuthenticatedUser
  ) {
    return this.reviews.page(
      applicationId,
      requiredActor(user),
      cursor ?? null,
      true
    );
  }

  @Put('mine')
  @Header('Cache-Control', 'no-store')
  publish(
    @Param('applicationId') applicationId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @AuthUser() user: AuthenticatedUser
  ) {
    return this.reviews.change(
      applicationId,
      null,
      'publish',
      body,
      requiredActor(user),
      key
    );
  }

  @Get(':id/reports')
  @Header('Cache-Control', 'no-store')
  reports(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Query('cursor') cursor: string | undefined,
    @AuthUser() user: AuthenticatedUser
  ) {
    return this.reviews.reports(
      applicationId,
      id,
      requiredActor(user),
      cursor ?? null
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.reviews.read(applicationId, id, discussionActor(user));
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  withdraw(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @AuthUser() user: AuthenticatedUser
  ) {
    return this.reviews.change(
      applicationId,
      id,
      'withdraw',
      body,
      requiredActor(user),
      key
    );
  }

  @Put(':id/helpful')
  @Header('Cache-Control', 'no-store')
  helpful(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @AuthUser() user: AuthenticatedUser
  ) {
    return this.reviews.change(
      applicationId,
      id,
      'helpful',
      body,
      requiredActor(user),
      key
    );
  }

  @Post(':id/reports')
  @Header('Cache-Control', 'no-store')
  report(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @AuthUser() user: AuthenticatedUser
  ) {
    return this.reviews.change(
      applicationId,
      id,
      'report',
      body,
      requiredActor(user),
      key
    );
  }

  @Put(':id/moderation')
  @Header('Cache-Control', 'no-store')
  moderate(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @AuthUser() user: AuthenticatedUser
  ) {
    return this.reviews.change(
      applicationId,
      id,
      'moderate',
      body,
      requiredActor(user),
      key
    );
  }
}
