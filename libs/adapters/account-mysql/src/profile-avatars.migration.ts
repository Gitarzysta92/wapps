import { createHash } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { isProfileAvatarId } from '@domains/customer/profiles';
import { canonicalSqlInteger } from './canonical-account-sql';
import { validateProfileAvatarImage } from './mysql-profile-avatars';

export class ProfileAvatars1791676828000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('identity_accounts')))
      throw new Error('Avatar migration requires canonical profiles');
    if (!(await runner.hasTable('identity_profile_avatars'))) {
      if (await runner.hasTable('migrations')) {
        const [history] = await runner.query(
          'SELECT id FROM migrations WHERE name = ?',
          ['ProfileAvatars1791676828000']
        );
        if (history)
          throw new Error('Previously migrated avatar authority is missing');
      }
      await runner.query(`CREATE TABLE identity_profile_avatars (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        payload mediumblob NOT NULL,
        sha256 char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        width smallint UNSIGNED NOT NULL,
        height smallint UNSIGNED NOT NULL,
        createdAt bigint UNSIGNED NOT NULL,
        PRIMARY KEY (identityId), UNIQUE KEY avatar_id (id),
        CONSTRAINT avatar_payload_bounds CHECK (OCTET_LENGTH(payload) BETWEEN 12 AND 262144 AND width BETWEEN 1 AND 512 AND height BETWEEN 1 AND 512 AND createdAt > 0)
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable('identity_profile_avatars');
    const metadata: {
      name: string;
      engine: string;
      collation: string | null;
    }[] = await runner.query(
      "SELECT c.COLUMN_NAME AS name, t.ENGINE AS engine, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = 'identity_profile_avatars'"
    );
    if (
      !table ||
      table.primaryColumns.length !== 1 ||
      table.primaryColumns[0].name !== 'identityId' ||
      table.columns.length !== 7
    )
      throw new Error('Incompatible avatar schema');
    for (const [name, type, length, collation] of [
      ['identityId', 'varchar', '128', 'utf8mb4_bin'],
      ['id', 'char', '36', 'ascii_bin'],
      ['payload', 'mediumblob', '', null],
      ['sha256', 'char', '64', 'ascii_bin'],
      ['width', 'smallint', '', null],
      ['height', 'smallint', '', null],
      ['createdAt', 'bigint', '', null],
    ]) {
      const column = table.columns.find((column) => column.name === name);
      const meta = metadata.find((column) => column.name === name);
      if (
        !column ||
        column.type !== type ||
        column.isNullable ||
        meta?.engine.toLowerCase() !== 'innodb' ||
        meta.collation !== collation ||
        (length && column.length !== length) ||
        (['width', 'height', 'createdAt'].includes(column.name) &&
          !column.unsigned)
      )
        throw new Error(`Incompatible avatar column ${name}`);
    }
    const indices: { name: string; columns: string; prefix: unknown }[] =
      await runner.query(
        "SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, MAX(SUB_PART) AS prefix FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'identity_profile_avatars' AND NON_UNIQUE = 0 GROUP BY INDEX_NAME"
      );
    if (
      indices.length !== 2 ||
      !indices.some(
        (index) =>
          index.name === 'PRIMARY' &&
          index.columns === 'identityId' &&
          index.prefix === null
      ) ||
      !indices.some((index) => index.columns === 'id' && index.prefix === null)
    )
      throw new Error('Incompatible avatar unique keys');
    const [constraint]: { enforced: string }[] = await runner.query(
      "SELECT ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'identity_profile_avatars' AND CONSTRAINT_NAME = 'avatar_payload_bounds' AND CONSTRAINT_TYPE = 'CHECK'"
    );
    if (constraint?.enforced !== 'YES')
      throw new Error('Avatar bounds must be enforced');
    const [check]: { clause: string }[] = await runner.query(
      "SELECT CHECK_CLAUSE AS clause FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'avatar_payload_bounds'"
    );
    if (
      check?.clause
        .replace(/[()`\s]/g, '')
        .toLowerCase()
        .replace(/^octet_length/, 'length') !==
      'lengthpayloadbetween12and262144andwidthbetween1and512andheightbetween1and512andcreatedat>0'
    )
      throw new Error(
        `Incompatible avatar bounds: ${JSON.stringify(check?.clause)}`
      );
    let after: string | null = null;
    for (;;) {
      const rows: {
        identityId: string;
        id: string;
        payload: Buffer;
        sha256: string;
        width: unknown;
        height: unknown;
        createdAt: unknown;
        isDeleted: unknown;
        accountId: string | null;
        avatarUri: string | null;
        updatedAt: unknown;
      }[] = await runner.query(
        'SELECT a.*, i.is_deleted AS isDeleted, p.identityId AS accountId, p.avatarUri, p.updatedAt FROM identity_profile_avatars a LEFT JOIN identities i ON BINARY i.claim = BINARY a.identityId LEFT JOIN identity_accounts p ON BINARY p.identityId = BINARY a.identityId WHERE (? IS NULL OR BINARY a.identityId > BINARY ?) ORDER BY BINARY a.identityId LIMIT 16',
        [after, after]
      );
      for (const row of rows) {
        if (
          !isProfileAvatarId(row.id) ||
          row.isDeleted !== 0 ||
          row.accountId !== row.identityId ||
          row.avatarUri !== null ||
          canonicalSqlInteger(row.createdAt, 1) >
            canonicalSqlInteger(row.updatedAt, 1)
        )
          throw new Error('Invalid avatar ownership or lifecycle');
        validateProfileAvatarImage({
          bytes: row.payload,
          width: canonicalSqlInteger(row.width, 1),
          height: canonicalSqlInteger(row.height, 1),
        });
        if (
          createHash('sha256').update(row.payload).digest('hex') !== row.sha256
        )
          throw new Error('Invalid avatar digest');
      }
      if (rows.length < 16) break;
      after = rows[rows.length - 1].identityId;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Avatar rollback requires a reviewed data-preserving migration'
    );
  }
}
