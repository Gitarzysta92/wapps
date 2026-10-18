import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DiscussionArticleTargets1791676822000 } from './discussion-article-targets.migration';

/** The existing target column/index are sufficient; this records the validated protocol upgrade. */
export class DiscussionApplicationTargets1791676823000
  implements MigrationInterface
{
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    await new DiscussionArticleTargets1791676822000().up(runner);
  }
  async down(): Promise<void> {
    throw new Error(
      'Application discussion bindings are authoritative; use a reviewed forward migration'
    );
  }
}
