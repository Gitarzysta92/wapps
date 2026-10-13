import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureJournalTable } from '@sdk/extras/mysql';
import { mentionInboxRecord } from './mysql-mention-inbox';

export class AccountMentions1791864017000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (
      !(await runner.hasTable('identities')) ||
      !(await runner.hasTable('identity_erasure_requests'))
    )
      throw new Error('Notifications require canonical accounts and erasure');
    const uuid = { type: 'char(36)', collation: 'ascii_bin' },
      time = { type: 'bigint unsigned' };
    await ensureJournalTable(runner, {
      name: 'identity_mention_notifications',
      migration: this.constructor.name,
      create: `CREATE TABLE identity_mention_notifications (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        discussionId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        nodeId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        revision bigint unsigned NOT NULL, createdAt bigint unsigned NOT NULL, receivedAt bigint unsigned NOT NULL,
        delivered tinyint unsigned NOT NULL, readAt bigint unsigned NULL,
        PRIMARY KEY (identityId,id), INDEX idx_mention_inbox_page (identityId,delivered,createdAt,id)
      ) ENGINE=InnoDB`,
      columns: {
        identityId: { type: 'varchar(128)', collation: 'utf8mb4_bin' },
        id: uuid,
        discussionId: uuid,
        nodeId: uuid,
        revision: time,
        createdAt: time,
        receivedAt: time,
        delivered: { type: 'tinyint unsigned' },
        readAt: { ...time, nullable: true },
      },
      indexes: {
        PRIMARY: { columns: ['identityId', 'id'], unique: true },
        idx_mention_inbox_page: {
          columns: ['identityId', 'delivered', 'createdAt', 'id'],
          unique: false,
        },
      },
    });
    const invalid: unknown[] =
      await runner.query(`SELECT id FROM identity_mention_notifications WHERE revision<1 OR
      id='' OR identityId='' OR id=discussionId OR id=nodeId OR delivered NOT IN (0,1) OR receivedAt<createdAt OR
      (readAt IS NOT NULL AND (delivered=0 OR readAt<receivedAt)) LIMIT 1`);
    if (invalid.length) throw new Error('Invalid account notification journal');
    let identity = '',
      id = '';
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT * FROM identity_mention_notifications WHERE identityId>? OR (identityId=? AND id>?) ORDER BY identityId,id LIMIT 128',
        [identity, identity, id]
      );
      for (const row of rows) {
        const record = mentionInboxRecord(row);
        identity = record.event.recipientId;
        id = record.event.id;
      }
      if (rows.length < 128) break;
    }
  }
  async down(): Promise<void> {
    throw new Error(
      'Inbox rollback must retain exact delivery receipts and erasure support'
    );
  }
}
