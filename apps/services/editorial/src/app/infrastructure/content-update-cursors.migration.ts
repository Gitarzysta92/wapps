import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureContentUpdateCursors } from '@sdk/extras/mysql';

export class EditorialContentUpdates1791840017000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('editorial_resource_states')))
      throw new Error('Content updates require canonical publications');
    await ensureContentUpdateCursors(runner, this.constructor.name, ['applications', 'suites', 'articles']);
  }
  async down(): Promise<void> {
    throw new Error('Content update rollback must preserve subscription versions');
  }
}
