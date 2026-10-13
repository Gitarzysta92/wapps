import type { MigrationInterface, QueryRunner } from 'typeorm';
import { isEditorialScope } from '../application/editorial-materialization';
import { ApplicationImageBindings1791676815000 } from './application-image-bindings.migration';
import { ArticleCoverReferences1791676820000 } from '../article-covers/article-cover-references.migration';
import {
  articleCoverFromRow,
  type ArticleCoverRow,
} from '../article-covers/mysql-article-covers';
import {
  applicationImageFromRow,
  type ApplicationImageRow,
} from './mysql-application-images';
import {
  editorialMediaAsset,
  editorialMediaAssetsApplied,
  recordEditorialMediaAsset,
  type EditorialMediaAsset,
  type EditorialMediaKind,
} from './editorial-media-assets';

type Row = Record<string, unknown>;
const sources = [
  {
    kind: 'application',
    table: 'application_image_uploads',
    cleanup: 'application_image_cleanup',
  },
  {
    kind: 'article',
    table: 'article_cover_uploads',
    cleanup: 'article_cover_cleanup',
  },
] as const;
const columns = [
  ['kind', 'varchar', '11', false],
  ['imageId', 'varchar', '36', false],
  ['tenantId', 'varchar', '128', false],
  ['articleId', 'varchar', '36', true],
  ['asset', 'json', '', true],
  ['createdAt', 'bigint', '', false],
  ['retiredAt', 'bigint', '', true],
] as const;

/** Representation-only backfill: immutable bytes, associations and public revisions do not change. */
export class EditorialMediaAssets1791840011000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    for (const { table, cleanup } of sources)
      for (const name of [table, cleanup])
        if (!(await runner.hasTable(name)))
          throw new Error(`Editorial media assets require ${name}`);
    const applied = await editorialMediaAssetsApplied(runner);
    const exists = await runner.hasTable('editorial_media_assets');
    if (exists) await this.schema(runner);
    else if (applied)
      throw new Error('Applied Editorial media assets schema is missing');
    // Reject invalid legacy/partially copied metadata before any MySQL DDL commits.
    await this.uploads(runner, async (records) => {
      for (const { id, kind, record } of records) {
        const [row]: Row[] = exists
          ? await runner.query(
              'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=?',
              [kind, id]
            )
          : [];
        if (
          row &&
          (!record ||
            JSON.stringify(editorialMediaAsset(row)) !== JSON.stringify(record))
        )
          throw new Error(
            'Editorial media backfill differs from upload authority'
          );
        if (applied && record && !row)
          throw new Error('Applied Editorial media descriptor is missing');
      }
    });
    if (exists) await this.records(runner);
    await this.references(runner, applied);
    if (!exists)
      await runner.query(`CREATE TABLE editorial_media_assets (
      kind varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      imageId varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      tenantId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      articleId varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
      asset json NULL, createdAt bigint UNSIGNED NOT NULL, retiredAt bigint UNSIGNED NULL,
      PRIMARY KEY (kind,imageId),
      INDEX idx_editorial_media_retirement (kind,retiredAt,createdAt,imageId)
    ) ENGINE=InnoDB`);
    if (!applied)
      await this.uploads(runner, async (records) => {
        await runner.startTransaction();
        try {
          for (const { record } of records)
            if (record) await recordEditorialMediaAsset(runner.manager, record);
          await runner.commitTransaction();
        } catch (error) {
          await runner.rollbackTransaction();
          throw error;
        }
      });
    await this.schema(runner);
    await this.records(runner);
    await this.references(runner, true);
  }

  private async references(runner: QueryRunner, registry: boolean) {
    await new ApplicationImageBindings1791676815000().validateReferences(
      runner,
      registry
    );
    await new ArticleCoverReferences1791676820000().validateReferences(
      runner,
      registry
    );
    for (const { kind, table, cleanup } of sources) {
      const invalid = await runner.query(
        registry
          ? `SELECT c.imageId FROM ${cleanup} c LEFT JOIN editorial_media_assets a ON a.kind=? AND a.imageId=c.imageId WHERE a.imageId IS NULL OR a.retiredAt IS NULL OR a.retiredAt<>c.createdAt OR a.asset IS NOT NULL LIMIT 1`
          : `SELECT c.imageId FROM ${cleanup} c LEFT JOIN ${table} i ON i.id=c.imageId WHERE i.id IS NULL OR i.status<>'cancelled' LIMIT 1`,
        registry ? [kind] : []
      );
      if (invalid.length)
        throw new Error('Invalid media retirement descriptor');
      if (
        registry &&
        (
          await runner.query(
            `SELECT a.imageId FROM editorial_media_assets a LEFT JOIN ${cleanup} c ON c.imageId=a.imageId WHERE a.kind=? AND a.retiredAt IS NOT NULL AND c.imageId IS NULL LIMIT 1`,
            [kind]
          )
        ).length
      )
        throw new Error('Retired media is missing its cleanup intent');
    }
  }

  private async uploads(
    runner: QueryRunner,
    page: (
      records: {
        id: string;
        kind: EditorialMediaKind;
        record: EditorialMediaAsset | null;
      }[]
    ) => Promise<void>
  ) {
    for (const source of sources) {
      let after = '';
      for (;;) {
        const rows: (ApplicationImageRow & ArticleCoverRow)[] =
          await runner.query(
            `SELECT i.*,c.createdAt AS retirementAt FROM ${source.table} i LEFT JOIN ${source.cleanup} c ON c.imageId=i.id WHERE i.id>? ORDER BY i.id LIMIT 128`,
            [after]
          );
        const records = rows.map((row) => {
          if (
            !isEditorialScope(row.tenantId) ||
            !isEditorialScope(row.ownerIdentityId)
          )
            throw new Error('Invalid media upload scope');
          const upload =
            source.kind === 'article'
              ? articleCoverFromRow(row)
              : applicationImageFromRow(row);
          if ((upload.status === 'cancelled') !== (row.retirementAt !== null))
            throw new Error('Invalid media retirement authority');
          return {
            id: upload.id,
            kind: source.kind,
            record:
              upload.status === 'pending'
                ? null
                : editorialMediaAsset({
                    kind: source.kind,
                    imageId: upload.id,
                    tenantId: row.tenantId,
                    articleId: source.kind === 'article' ? row.articleId : null,
                    asset: upload.asset,
                    createdAt: upload.createdAt,
                    retiredAt:
                      upload.status === 'cancelled' ? row.retirementAt : null,
                  }),
          };
        });
        await page(records);
        if (rows.length < 128) break;
        after = rows[rows.length - 1].id;
      }
    }
  }

  private async records(runner: QueryRunner) {
    let after = ['', ''];
    for (;;) {
      const rows: Row[] = await runner.query(
        'SELECT * FROM editorial_media_assets WHERE (kind,imageId)>(?,?) ORDER BY kind,imageId LIMIT 128',
        after
      );
      for (const row of rows) {
        const record = editorialMediaAsset(row);
        after = [record.kind, record.imageId];
      }
      if (rows.length < 128) return;
    }
  }

  private async schema(runner: QueryRunner) {
    const table = await runner.getTable('editorial_media_assets');
    const meta: Row[] = await runner.query(
      "SELECT c.COLUMN_NAME AS name,c.COLLATION_NAME AS collation,c.CHARACTER_MAXIMUM_LENGTH AS length,t.ENGINE AS engine FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME='editorial_media_assets'"
    );
    const triggers: Row[] = await runner.query(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='editorial_media_assets'"
    );
    if (
      !table ||
      table.columns.length !== columns.length ||
      table.foreignKeys.length ||
      table.indices.length !== 1 ||
      triggers.length
    )
      throw new Error('Incompatible Editorial media schema');
    for (const [name, type, length, nullable] of columns) {
      const column = table.findColumnByName(name),
        info = meta.find((row) => row.name === name);
      if (
        !column ||
        column.type !== type ||
        column.isNullable !== nullable ||
        column.isGenerated ||
        column.unsigned !== (type === 'bigint') ||
        column.isPrimary !== ['kind', 'imageId'].includes(name) ||
        info?.engine !== 'InnoDB' ||
        info.collation !== (type === 'varchar' ? 'utf8mb4_bin' : null) ||
        (type === 'varchar' && String(info.length) !== length)
      )
        throw new Error(`Incompatible Editorial media column: ${name}`);
    }
    for (const [name, expected, unique] of [
      ['PRIMARY', ['kind', 'imageId'], true],
      [
        'idx_editorial_media_retirement',
        ['kind', 'retiredAt', 'createdAt', 'imageId'],
        false,
      ],
    ] as const) {
      const rows: Row[] = await runner.query(
        "SELECT COLUMN_NAME AS name,SUB_PART AS prefix,NON_UNIQUE AS nonUnique,COLLATION AS direction,IS_VISIBLE AS visible,EXPRESSION AS expression FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='editorial_media_assets' AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX",
        [name]
      );
      if (
        rows.length !== expected.length ||
        rows.some(
          (row, index) =>
            row.name !== expected[index] ||
            row.prefix !== null ||
            Number(row.nonUnique) !== (unique ? 0 : 1) ||
            row.direction !== 'A' ||
            row.visible !== 'YES' ||
            row.expression !== null
        )
      )
        throw new Error(`Incompatible Editorial media index: ${name}`);
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Editorial media descriptors and retirement guards are authoritative; use a reviewed data-preserving migration'
    );
  }
}
