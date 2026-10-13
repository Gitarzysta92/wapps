import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';
import {
  applicationImageExternalUrl,
  applicationImageId,
  applicationImageInteger,
  applicationImagePurpose,
  parseApplicationImageAsset,
  type ApplicationImageAsset,
} from '@domains/catalog/media';
import {
  applicationImageFromRow,
  type ApplicationImageRow,
} from './mysql-application-images';
import {
  APPLICATION_IMAGE_PURPOSES,
  applicationPublishedImagePath,
} from './application-image-bindings';
import {
  editorialMediaAsset,
  editorialMediaAssetsApplied,
} from './editorial-media-assets';

interface BindingMigrationRow {
  [column: string]: string | number | null | undefined;
  draftId?: string;
  applicationId?: string;
  purpose: string;
  imageId: string | null;
  url: string | null;
  submittedRevision?: string | number;
  publicationRevision?: string | number;
}

export class ApplicationImageBindings1791676815000
  implements MigrationInterface
{
  transaction = false;
  async up(runner: QueryRunner) {
    const registry = await editorialMediaAssetsApplied(runner);
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const completed =
      (await runner.hasTable(history)) &&
      (
        await runner.query(
          `SELECT id FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          ['ApplicationImageBindings1791676815000']
        )
      ).length > 0;
    const text = (
      name: string,
      length: string,
      isPrimary = false,
      isNullable = false
    ) => ({ name, type: 'varchar', length, isPrimary, isNullable });
    const integer = (name: string, isPrimary = false) => ({
      name,
      type: 'bigint',
      unsigned: true,
      isPrimary,
    });
    const tables = [
      new Table({
        name: 'application_draft_images',
        columns: [
          text('draftId', '36', true),
          text('purpose', '6', true),
          text('imageId', '36', false, true),
          text('url', '255', false, true),
        ],
        indices: [
          { name: 'idx_draft_image_reference', columnNames: ['imageId'] },
        ],
      }),
      new Table({
        name: 'application_submission_images',
        columns: [
          text('draftId', '36', true),
          integer('submittedRevision', true),
          text('purpose', '6', true),
          text('imageId', '36', false, true),
          text('url', '255', false, true),
        ],
        indices: [
          { name: 'idx_submission_image_reference', columnNames: ['imageId'] },
        ],
      }),
      new Table({
        name: 'application_published_images',
        columns: [
          text('applicationId', '36', true),
          text('purpose', '6', true),
          text('imageId', '36'),
          text('url', '255'),
          integer('publicationRevision'),
        ],
        indices: [
          { name: 'idx_published_image_reference', columnNames: ['imageId'] },
        ],
      }),
    ];
    for (const table of tables) {
      table.engine = 'InnoDB';
      for (const column of table.columns)
        if (column.type === 'varchar') {
          column.charset = 'utf8mb4';
          column.collation = 'utf8mb4_bin';
        }
      if (!(await runner.hasTable(table.name))) {
        if (completed)
          throw new Error(
            'Completed application image binding schema is missing'
          );
        await runner.createTable(table);
      }
      const actual = await runner.getTable(table.name);
      const [storage] = await runner.query(
        'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table.name]
      );
      const physical: {
        name: string;
        collation: string | null;
        length: number | null;
      }[] = await runner.query(
        'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation, CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table.name]
      );
      const keys: { name: string }[] = await runner.query(
        "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
        [table.name]
      );
      if (
        storage?.engine !== 'InnoDB' ||
        !actual ||
        actual.columns.length !== table.columns.length ||
        JSON.stringify(keys.map((key) => key.name)) !==
          JSON.stringify(table.primaryColumns.map((column) => column.name)) ||
        table.columns.some((expected) => {
          const column = actual.columns.find(
            (item) => item.name === expected.name
          );
          return (
            !column ||
            column.type !== expected.type ||
            (expected.type === 'varchar'
              ? String(
                  physical.find((item) => item.name === expected.name)?.length
                ) !== expected.length
              : column.length !== expected.length) ||
            column.isNullable !== expected.isNullable ||
            column.isPrimary !== expected.isPrimary ||
            column.unsigned !== expected.unsigned ||
            (expected.collation &&
              physical.find((item) => item.name === expected.name)
                ?.collation !== expected.collation)
          );
        }) ||
        table.indices.some(
          (expected) =>
            !actual.indices.some(
              (index) =>
                index.name === expected.name &&
                !index.isUnique &&
                JSON.stringify(index.columnNames) ===
                  JSON.stringify(expected.columnNames)
            )
        )
      )
        throw new Error(
          `Incompatible application image binding schema: ${table.name}; ` +
            JSON.stringify({
              engine: storage?.engine,
              keys: keys.map((key) => key.name),
              columns: actual?.columns.map((column) => ({
                name: column.name,
                type: column.type,
                length: column.length,
                nullable: column.isNullable,
                primary: column.isPrimary,
                unsigned: column.unsigned,
              })),
              indices: actual?.indices.map((index) => ({
                name: index.name,
                columns: index.columnNames,
                unique: index.isUnique,
              })),
              physical,
            })
        );
    }
    let cursor = '';
    for (;;) {
      const rows: {
        id: string;
        deletedAt: string | number | null;
        logoUrl: string | null;
        bannerUrl: string | null;
      }[] = await runner.query(
        `SELECT d.id, d.deletedAt, a.logoUrl, a.bannerUrl FROM application_drafts d
        LEFT JOIN application_editing_targets e ON e.draftId = d.id LEFT JOIN app_records a ON a.id = COALESCE(e.applicationId, d.id)
        WHERE d.id > ? ORDER BY d.id LIMIT 200`,
        [cursor]
      );
      for (const row of rows) {
        const existing = await runner.query(
          'SELECT purpose FROM application_draft_images WHERE draftId = ?',
          [row.id]
        );
        if (existing.length === 0) {
          if (completed)
            throw new Error('Application draft image snapshot is missing');
          // Existing private work keeps current legacy URLs; historical submissions remain explicitly unknown.
          const logo =
            row.deletedAt === null && row.logoUrl !== null
              ? applicationImageExternalUrl(row.logoUrl)
              : null;
          const banner =
            row.deletedAt === null && row.bannerUrl !== null
              ? applicationImageExternalUrl(row.bannerUrl)
              : null;
          await runner.startTransaction();
          try {
            for (const purpose of APPLICATION_IMAGE_PURPOSES)
              await runner.query(
                'INSERT INTO application_draft_images (draftId, purpose, imageId, url) VALUES (?, ?, NULL, ?)',
                [row.id, purpose, purpose === 'logo' ? logo : banner]
              );
            await runner.commitTransaction();
          } catch (error) {
            await runner.rollbackTransaction();
            throw error;
          }
        } else if (existing.length !== 2)
          throw new Error('Application draft image snapshot is incomplete');
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].id;
    }
    await this.validateReferences(runner, registry);
  }
  async validateReferences(runner: QueryRunner, registry: boolean) {
    const incomplete = await runner.query(
      'SELECT d.id FROM application_drafts d LEFT JOIN application_draft_images i ON i.draftId=d.id GROUP BY d.id HAVING COUNT(i.purpose)<>2 LIMIT 1'
    );
    if (incomplete.length)
      throw new Error('Application draft image snapshot is incomplete');
    for (const [name, columns] of [
      ['application_draft_images', ['draftId', 'purpose']],
      [
        'application_submission_images',
        ['draftId', 'submittedRevision', 'purpose'],
      ],
      ['application_published_images', ['applicationId', 'purpose']],
    ] as const) {
      let previous: unknown[] | null = null;
      for (;;) {
        const where: string = previous
          ? ` WHERE (${columns.join(', ')}) > (${columns
              .map(() => '?')
              .join(', ')})`
          : '';
        const rows: BindingMigrationRow[] = await runner.query(
          `SELECT * FROM ${name}${where} ORDER BY ${columns.join(
            ', '
          )} LIMIT 200`,
          previous ?? []
        );
        for (const row of rows) {
          const id = applicationImageId(row.draftId ?? row.applicationId);
          const purpose = applicationImagePurpose(row.purpose);
          if (row.submittedRevision !== undefined)
            applicationImageInteger(Number(row.submittedRevision));
          if (row.publicationRevision !== undefined)
            applicationImageInteger(Number(row.publicationRevision));
          if (row.url !== null) applicationImageExternalUrl(row.url);
          if (
            name !== 'application_published_images' &&
            row.url !== null &&
            row.imageId !== null
          )
            throw new Error('Ambiguous application image binding');
          if (row.imageId !== null) {
            applicationImageId(row.imageId);
            let asset: ApplicationImageAsset | null;
            if (registry) {
              const [image]: Record<string, unknown>[] = await runner.query(
                "SELECT * FROM editorial_media_assets WHERE kind='application' AND imageId=?",
                [row.imageId]
              );
              const current = image ? editorialMediaAsset(image).asset : null;
              asset = current ? parseApplicationImageAsset(current) : null;
            } else {
              const [image]: ApplicationImageRow[] = await runner.query(
                'SELECT * FROM application_image_uploads WHERE id = ?',
                [row.imageId]
              );
              asset = image ? applicationImageFromRow(image).asset : null;
            }
            if (!asset || asset.purpose !== purpose)
              throw new Error(
                'Application image binding references an unavailable asset'
              );
            if (
              name === 'application_published_images' &&
              (row.url === null ||
                new URL(row.url).pathname !==
                  applicationPublishedImagePath(id, purpose, row.imageId))
            )
              throw new Error('Invalid public application image URL binding');
          }
        }
        if (rows.length < 200) break;
        const last = rows[rows.length - 1];
        previous = columns.map((column) => last[column]);
      }
    }
    const images = registry
      ? "(SELECT imageId AS id,tenantId FROM editorial_media_assets WHERE kind='application' AND retiredAt IS NULL)"
      : 'application_image_uploads';
    const invalid = [
      `SELECT i.draftId FROM application_draft_images i LEFT JOIN application_drafts d ON d.id = i.draftId LEFT JOIN ${images} u ON u.id = i.imageId WHERE d.id IS NULL OR (d.deletedAt IS NOT NULL AND (i.imageId IS NOT NULL OR i.url IS NOT NULL)) OR (i.imageId IS NOT NULL AND (u.id IS NULL OR u.tenantId <> d.tenantId)) LIMIT 1`,
      `SELECT i.draftId FROM application_submission_images i LEFT JOIN application_submissions s ON s.applicationId = i.draftId AND s.submittedRevision = i.submittedRevision LEFT JOIN ${images} u ON u.id = i.imageId WHERE s.applicationId IS NULL OR (i.imageId IS NOT NULL AND (u.id IS NULL OR u.tenantId <> s.tenantId)) LIMIT 1`,
      `SELECT i.applicationId FROM application_published_images i LEFT JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = i.applicationId LEFT JOIN ${images} u ON u.id = i.imageId WHERE s.resourceId IS NULL OR u.id IS NULL OR s.tenantId <> u.tenantId OR i.publicationRevision > s.revision LIMIT 1`,
      `SELECT draftId FROM application_submission_images GROUP BY draftId, submittedRevision HAVING COUNT(*) <> 2 LIMIT 1`,
    ];
    for (const query of invalid)
      if ((await runner.query(query)).length)
        throw new Error('Invalid application image binding relationships');
  }
  async down(): Promise<void> {
    throw new Error(
      'Application image references are authoritative; use a reviewed data-preserving migration'
    );
  }
}
