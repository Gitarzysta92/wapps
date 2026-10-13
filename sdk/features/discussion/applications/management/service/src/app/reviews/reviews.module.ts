import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { OpaPolicyEvaluator } from '../discussions/infrastructure/opa-policy-evaluator';
import { EditorialDiscussionTargets } from '../discussions/infrastructure/editorial-discussion-targets';
import { ApplicationReviews } from './application/application-reviews';
import { MysqlReviews } from './infrastructure/mysql-reviews';
import { ApplicationReviewsController } from './application-reviews.controller';

@Module({
  exports: [ApplicationReviews],
  controllers: [ApplicationReviewsController],
  providers: [
    {
      provide: ApplicationReviews,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) => {
        const tenant =
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default';
        const targets = new EditorialDiscussionTargets(
          config.get<string>('EDITORIAL_URL'),
          tenant
        );
        return new ApplicationReviews(
          new MysqlReviews(source),
          {
            visible: (applicationId, tenantId) =>
              targets.visible(
                { kind: 'application', id: applicationId },
                tenantId
              ),
          },
          new OpaPolicyEvaluator(),
          {
            next: randomUUID,
            fingerprint: (value) =>
              createHash('sha256').update(value).digest('hex'),
          },
          tenant
        );
      },
    },
  ],
})
export class ReviewsModule {}
