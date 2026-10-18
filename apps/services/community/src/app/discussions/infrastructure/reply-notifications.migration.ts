import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureJournalTable } from '@sdk/extras/mysql';
import { replyNotificationJournalRow } from './mysql-reply-notifications';

export class ReplyNotifications1791840015000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (
      !(await runner.hasTable('identity_erasure_barriers')) ||
      !(await runner.hasTable('discussion_write_nodes'))
    )
      throw new Error(
        'Reply notifications require canonical writers and erasure barriers'
      );
    const uuid = { type: 'char(36)', collation: 'ascii_bin' };
    const time = { type: 'bigint unsigned' };
    await ensureJournalTable(runner, {
      name: 'discussion_reply_notifications',
      migration: this.constructor.name,
      create: `CREATE TABLE discussion_reply_notifications (
        id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
        recipientId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        discussionId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        parentId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        revision bigint unsigned NOT NULL, createdAt bigint unsigned NOT NULL,
        availableAt bigint unsigned NOT NULL, attempts int unsigned NOT NULL DEFAULT 0,
        leaseToken char(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
        leasedUntil bigint unsigned NULL, deliveredAt bigint unsigned NULL, failedAt bigint unsigned NULL,
        INDEX idx_reply_delivery (deliveredAt,failedAt,availableAt,id),
        INDEX idx_reply_recipient (recipientId,id)
      ) ENGINE=InnoDB`,
      columns: {
        id: uuid,
        recipientId: { type: 'varchar(128)', collation: 'utf8mb4_bin' },
        discussionId: uuid,
        parentId: uuid,
        revision: time,
        createdAt: time,
        availableAt: time,
        attempts: { type: 'int unsigned', initial: '0' },
        leaseToken: { ...uuid, nullable: true },
        leasedUntil: { ...time, nullable: true },
        deliveredAt: { ...time, nullable: true },
        failedAt: { ...time, nullable: true },
      },
      indexes: {
        PRIMARY: { columns: ['id'], unique: true },
        idx_reply_delivery: {
          columns: ['deliveredAt', 'failedAt', 'availableAt', 'id'],
          unique: false,
        },
        idx_reply_recipient: { columns: ['recipientId', 'id'], unique: false },
      },
    });
    const invalid: unknown[] =
      await runner.query(`SELECT id FROM discussion_reply_notifications WHERE
      id='' OR recipientId='' OR revision < 2 OR id=discussionId OR id=parentId OR attempts>12 OR
      (leaseToken IS NULL)<>(leasedUntil IS NULL) OR (deliveredAt IS NOT NULL AND failedAt IS NOT NULL) OR
      (deliveredAt IS NOT NULL AND leaseToken IS NOT NULL) OR (failedAt IS NOT NULL AND leaseToken IS NOT NULL) LIMIT 1`);
    if (invalid.length)
      throw new Error('Invalid reply notification delivery journal');
    let after = '';
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT * FROM discussion_reply_notifications WHERE id>? ORDER BY id LIMIT 128',
        [after]
      );
      for (const row of rows) after = replyNotificationJournalRow(row).event.id;
      if (rows.length < 128) break;
    }
  }
  async down(): Promise<void> {
    throw new Error(
      'Reply delivery requires a reviewed data-preserving rollback'
    );
  }
}
