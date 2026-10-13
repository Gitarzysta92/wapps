import type { EntityManager, QueryRunner } from 'typeorm';
import {
  applicationImageId,
  parseApplicationImageAsset,
  parseArticleCoverAsset,
  type ApplicationImageAsset,
  type ArticleCoverAsset,
} from '@domains/catalog/media';
import { isEditorialScope } from '../application/editorial-materialization';
import { editorialSqlInteger } from '../infrastructure/mysql-editorial-snapshot';

export const EDITORIAL_MEDIA_ASSETS = 'EditorialMediaAssets1791840011000';
export type EditorialMediaKind = 'application' | 'article';
export interface EditorialMediaAsset {
  kind: EditorialMediaKind;
  imageId: string;
  tenantId: string;
  articleId: string | null;
  asset: ApplicationImageAsset | ArticleCoverAsset | null;
  createdAt: number;
  retiredAt: number | null;
}

export function editorialMediaAsset(
  row: Record<string, unknown>
): EditorialMediaAsset {
  if (
    (row.kind !== 'application' && row.kind !== 'article') ||
    !isEditorialScope(row.tenantId)
  )
    throw new Error('Invalid Editorial media scope');
  const imageId = applicationImageId(row.imageId);
  const articleId =
    row.kind === 'article' ? applicationImageId(row.articleId) : null;
  if (row.kind === 'application' && row.articleId !== null)
    throw new Error('Application media cannot be an article cover');
  const createdAt = editorialSqlInteger(row.createdAt);
  const retiredAt =
    row.retiredAt === null ? null : editorialSqlInteger(row.retiredAt);
  const input =
    typeof row.asset === 'string' ? JSON.parse(row.asset) : row.asset;
  const asset =
    input === null
      ? null
      : row.kind === 'application'
      ? parseApplicationImageAsset(input)
      : parseArticleCoverAsset(input);
  if (
    (asset === null) !== (retiredAt !== null) ||
    (asset && asset.id !== imageId) ||
    (retiredAt !== null && retiredAt < createdAt)
  )
    throw new Error('Invalid Editorial media lifecycle');
  return {
    kind: row.kind,
    imageId,
    tenantId: row.tenantId,
    articleId,
    asset,
    createdAt,
    retiredAt,
  };
}

export async function editorialMediaAssetsApplied(runner: QueryRunner) {
  return (
    (await runner.hasTable('editorial_migrations')) &&
    (
      await runner.query(
        'SELECT name FROM editorial_migrations WHERE name=? LIMIT 1',
        [EDITORIAL_MEDIA_ASSETS]
      )
    ).length > 0
  );
}

async function readAsset(
  manager: EntityManager,
  kind: EditorialMediaKind,
  imageId: string,
  tenant: string,
  lock: boolean
) {
  if (lock && !manager.queryRunner?.isTransactionActive)
    throw new Error('Media references require a canonical transaction');
  const [row]: Record<string, unknown>[] = await manager.query(
    'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=? AND tenantId=?' +
      (lock ? ' FOR UPDATE' : ''),
    [kind, imageId, tenant]
  );
  return row ? editorialMediaAsset(row) : null;
}

export async function applicationMediaAsset(
  manager: EntityManager,
  imageId: string,
  tenant: string,
  lock = false
): Promise<ApplicationImageAsset | null> {
  const row = await readAsset(manager, 'application', imageId, tenant, lock);
  return row?.asset ? parseApplicationImageAsset(row.asset) : null;
}

export async function articleMediaAsset(
  manager: EntityManager,
  imageId: string,
  articleId: string,
  tenant: string,
  lock = false
): Promise<ArticleCoverAsset | null> {
  const row = await readAsset(manager, 'article', imageId, tenant, lock);
  return row?.asset && row.articleId === articleId
    ? parseArticleCoverAsset(row.asset)
    : null;
}

/** The private upload and immutable descriptor commit together; a retired key never becomes live again. */
export async function recordEditorialMediaAsset(
  manager: EntityManager,
  input: EditorialMediaAsset
) {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Media registration requires a canonical transaction');
  const record = editorialMediaAsset({ ...input });
  await manager.query(
    `INSERT INTO editorial_media_assets (kind,imageId,tenantId,articleId,asset,createdAt,retiredAt) VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE imageId=imageId`,
    [
      record.kind,
      record.imageId,
      record.tenantId,
      record.articleId,
      record.asset === null ? null : JSON.stringify(record.asset),
      record.createdAt,
      record.retiredAt,
    ]
  );
  const stored = await readAsset(
    manager,
    record.kind,
    record.imageId,
    record.tenantId,
    true
  );
  if (JSON.stringify(stored) !== JSON.stringify(record))
    throw new Error('Immutable Editorial media descriptor conflicts');
}

/** Retirement and every new reference serialize here, independently of private uploader history. */
export async function lockEditorialMediaAsset(
  manager: EntityManager,
  kind: EditorialMediaKind,
  imageId: string
) {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Media references require a canonical transaction');
  const [row]: Record<string, unknown>[] = await manager.query(
    'SELECT * FROM editorial_media_assets WHERE kind=? AND imageId=? FOR UPDATE',
    [kind, imageId]
  );
  return row ? editorialMediaAsset(row) : null;
}

export async function retireEditorialMediaAsset(
  manager: EntityManager,
  kind: EditorialMediaKind,
  imageId: string,
  at: number
) {
  const table =
    kind === 'application'
      ? 'application_image_uploads'
      : 'article_cover_uploads';
  const [upload]: Record<string, unknown>[] = await manager.query(
    `SELECT * FROM ${table} WHERE id=? FOR UPDATE`,
    [imageId]
  );
  if (
    !upload ||
    !isEditorialScope(upload.tenantId) ||
    !['pending', 'ready'].includes(String(upload.status))
  )
    throw new Error('Missing private media retirement authority');
  await lockEditorialMediaAsset(manager, kind, imageId);
  if (upload.status === 'ready') {
    const current = await readAsset(
      manager,
      kind,
      imageId,
      upload.tenantId,
      true
    );
    if (!current || !current.asset)
      throw new Error('Missing live media descriptor');
    const expected = editorialMediaAsset({
      kind,
      imageId,
      tenantId: upload.tenantId,
      articleId: kind === 'article' ? upload.articleId : null,
      asset: upload.asset,
      createdAt: upload.createdAt,
      retiredAt: null,
    });
    if (JSON.stringify(current) !== JSON.stringify(expected))
      throw new Error('Private upload differs from immutable media authority');
    const retired = editorialMediaAsset({
      ...current,
      asset: null,
      retiredAt: at,
    });
    await manager.query(
      'UPDATE editorial_media_assets SET asset=NULL,retiredAt=? WHERE kind=? AND imageId=?',
      [retired.retiredAt, kind, imageId]
    );
  } else {
    await recordEditorialMediaAsset(manager, {
      kind,
      imageId,
      tenantId: upload.tenantId,
      articleId:
        kind === 'article' ? applicationImageId(upload.articleId) : null,
      asset: null,
      createdAt: editorialSqlInteger(upload.createdAt),
      retiredAt: at,
    });
  }
}
