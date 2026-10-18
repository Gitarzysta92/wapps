import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ProfileBadges1791676831000 } from './profile-badges.migration';

/** Erased staff attribution has no actor or command replay credentials, while decision history remains. */
export class ProfileBadgeErasure1791840003000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (
      !(await runner.hasTable('identity_erasure_requests')) ||
      !(await runner.hasTable('identity_profile_badge_events'))
    )
      throw new Error(
        'Badge erasure requires retained badges and erasure requests'
      );
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const applied: unknown[] = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT name FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          [this.constructor.name]
        )
      : [];
    const table = await runner.getTable('identity_profile_badge_events');
    const columns = ['reason', 'actorId', 'commandKey', 'fingerprint'].map(
      (name) => table?.columns.find((column) => column.name === name)
    );
    if (columns.some((column) => !column))
      throw new Error('Incompatible badge erasure schema');
    const nullable = columns.filter((column) => column?.isNullable).length;
    if (nullable === 0) {
      if (applied.length)
        throw new Error('Applied badge erasure schema is missing');
      await new ProfileBadges1791676831000().up(runner, false);
      await runner.query(`ALTER TABLE identity_profile_badge_events
        MODIFY reason varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
        MODIFY actorId char(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
        MODIFY commandKey varchar(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
        MODIFY fingerprint char(64) CHARACTER SET ascii COLLATE ascii_bin NULL`);
    } else if (nullable !== 4) throw new Error('Partial badge erasure schema');
    await new ProfileBadges1791676831000().up(runner, true);
  }
  async down(): Promise<void> {
    throw new Error(
      'Badge erasure requires a reviewed data-preserving rollback'
    );
  }
}
