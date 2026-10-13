import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureContentUpdateCursors } from '@sdk/extras/mysql';

export class DiscussionContentUpdates1791840018000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('discussion_write_aggregates')))
      throw new Error('Content updates require canonical discussions');
    await ensureContentUpdateCursors(runner, this.constructor.name, ['discussions']);
  }
  async down(): Promise<void> {
    throw new Error('Content update rollback must preserve subscription versions');
  }
}
