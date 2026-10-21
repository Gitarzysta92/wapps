import type { EntityManager, QueryRunner } from 'typeorm';
import { ensureJournalTable } from './validated-journal-table';

/** Call only in the transaction that commits the corresponding public content change. */
export async function advanceContentUpdateCursor(
  tx: EntityManager,
  kind: string,
  id: string,
  at: number
): Promise<void> {
  if (
    !/^[a-z]{1,16}$/.test(kind) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id
    ) ||
    !Number.isSafeInteger(at) ||
    at < 1 ||
    at > 8_640_000_000_000_000
  )
    throw new Error('Invalid content update cursor');
  await tx.query(
    `INSERT INTO content_update_cursors (targetKind,targetId,version,updatedAt) VALUES (?,?,1,?)
     ON DUPLICATE KEY UPDATE version=IF(version<9007199254740991,version+1,NULL),updatedAt=GREATEST(updatedAt,VALUES(updatedAt))`,
    [kind, id, at]
  );
}

export async function ensureContentUpdateCursors(
  runner: QueryRunner,
  migration: string,
  kinds: readonly string[]
): Promise<void> {
  await ensureJournalTable(runner, {
    name: 'content_update_cursors',
    migration,
    create: `CREATE TABLE content_update_cursors (
      targetKind varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      targetId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      version bigint unsigned NOT NULL, updatedAt bigint unsigned NOT NULL,
      PRIMARY KEY (targetKind,targetId)
    ) ENGINE=InnoDB`,
    columns: {
      targetKind: { type: 'varchar(16)', collation: 'ascii_bin' },
      targetId: { type: 'char(36)', collation: 'ascii_bin' },
      version: { type: 'bigint unsigned' },
      updatedAt: { type: 'bigint unsigned' },
    },
    indexes: { PRIMARY: { columns: ['targetKind', 'targetId'], unique: true } },
  });
  let kind = '',
    id = '';
  for (;;) {
    const rows: Record<string, unknown>[] = await runner.query(
      'SELECT * FROM content_update_cursors WHERE targetKind>? OR (targetKind=? AND targetId>?) ORDER BY targetKind,targetId LIMIT 128',
      [kind, kind, id]
    );
    for (const row of rows) {
      if (
        typeof row['targetKind'] !== 'string' ||
        !kinds.includes(row['targetKind']) ||
        typeof row['targetId'] !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          row['targetId']
        ) ||
        !Number.isSafeInteger(Number(row['version'])) ||
        Number(row['version']) < 1 ||
        !Number.isSafeInteger(Number(row['updatedAt'])) ||
        Number(row['updatedAt']) < 1 ||
        Number(row['updatedAt']) > 8_640_000_000_000_000
      )
        throw new Error('Invalid content update journal');
      kind = row['targetKind'];
      id = row['targetId'];
    }
    if (rows.length < 128) break;
  }
}
