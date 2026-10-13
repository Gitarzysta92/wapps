import {
  APPLICATION_IMAGE_SOURCE_LIMIT,
  APPLICATION_IMAGE_OUTPUT_LIMIT,
  APPLICATION_IMAGE_UPLOAD_LIFETIME,
  APPLICATION_IMAGE_PENDING_LIMIT,
  APPLICATION_IMAGE_DAILY_LIMIT,
  APPLICATION_IMAGE_RETAINED_LIMIT,
  APPLICATION_IMAGE_ATTEMPT_LIMIT,
  applicationImageObject,
  applicationImageId,
  applicationImageInteger,
  parseApplicationImageSource,
  parseApplicationImageAsset,
  parseApplicationImageUpload,
  parseApplicationImageUploadReceipt,
  assertApplicationImageUploadWritable,
  type ApplicationImageAsset,
  type ApplicationImageSource,
  type ApplicationImageUploadReceipt,
} from './application-image';
import {
  APPLICATION_IMAGE_UNUSED_LIFETIME,
  applicationImageRetirementReason,
  assertApplicationImageCancellation,
} from './application-image-retention';

export {
  ApplicationImageInputError as ArticleCoverInputError,
  ApplicationImageConflictError as ArticleCoverConflictError,
  ApplicationImageNotFoundError as ArticleCoverNotFoundError,
  ApplicationImageUnavailableError as ArticleCoverUnavailableError,
  ApplicationImageRateLimitError as ArticleCoverRateLimitError,
  type ApplicationImageSourceType as ArticleCoverSourceType,
} from './application-image';
export type { ApplicationImageRetirementReason as ArticleCoverRetirementReason } from './application-image-retention';
export const ARTICLE_COVER_SOURCE_LIMIT = APPLICATION_IMAGE_SOURCE_LIMIT;
export const ARTICLE_COVER_OUTPUT_LIMIT = APPLICATION_IMAGE_OUTPUT_LIMIT;
export const parseArticleCoverSource = parseApplicationImageSource;
export type ArticleCoverSource = ApplicationImageSource;
export const ARTICLE_COVER_UPLOAD_LIFETIME = APPLICATION_IMAGE_UPLOAD_LIFETIME;
export const ARTICLE_COVER_PENDING_LIMIT = APPLICATION_IMAGE_PENDING_LIMIT;
export const ARTICLE_COVER_DAILY_LIMIT = APPLICATION_IMAGE_DAILY_LIMIT;
export const ARTICLE_COVER_RETAINED_LIMIT = APPLICATION_IMAGE_RETAINED_LIMIT;
export const ARTICLE_COVER_ATTEMPT_LIMIT = APPLICATION_IMAGE_ATTEMPT_LIMIT;
export const ARTICLE_COVER_UNUSED_LIFETIME = APPLICATION_IMAGE_UNUSED_LIFETIME;
export const articleCoverObject = applicationImageObject;
export const articleCoverId = applicationImageId;
export const articleCoverInteger = applicationImageInteger;
export const parseArticleCoverUploadReceipt =
  parseApplicationImageUploadReceipt;
export type ArticleCoverUploadReceipt = ApplicationImageUploadReceipt;
export type ArticleCoverAsset = Omit<ApplicationImageAsset, 'purpose'>;
export interface ArticleCoverUploadInput {
  articleId: string;
  source: ApplicationImageSource;
}
export interface ArticleCoverUpload
  extends ArticleCoverUploadInput,
    ArticleCoverUploadReceipt {
  createdAt: number;
  expiresAt: number;
  asset: ArticleCoverAsset | null;
}

// Article covers use the existing bounded landscape-image policy, without application ownership or slots.
export function parseArticleCoverAsset(input: unknown): ArticleCoverAsset {
  const value = articleCoverObject(input, [
    'id',
    'contentType',
    'bytes',
    'sha256',
    'width',
    'height',
  ]);
  const asset = parseApplicationImageAsset({ ...value, purpose: 'banner' });
  return {
    id: asset.id,
    contentType: asset.contentType,
    bytes: asset.bytes,
    sha256: asset.sha256,
    width: asset.width,
    height: asset.height,
  };
}
export function parseArticleCoverUploadInput(
  input: unknown
): ArticleCoverUploadInput {
  const value = articleCoverObject(input, ['articleId', 'source']);
  return {
    articleId: articleCoverId(value['articleId']),
    source: parseApplicationImageSource(value['source']),
  };
}
function imageUpload(upload: ArticleCoverUpload) {
  return {
    ...upload,
    draftId: upload.articleId,
    purpose: 'banner' as const,
    asset: upload.asset
      ? { ...upload.asset, purpose: 'banner' as const }
      : null,
  };
}
export function parseArticleCoverUpload(input: unknown): ArticleCoverUpload {
  const value = articleCoverObject(input, [
    'id',
    'revision',
    'status',
    'articleId',
    'source',
    'createdAt',
    'expiresAt',
    'asset',
  ]);
  const request = parseArticleCoverUploadInput({
    articleId: value['articleId'],
    source: value['source'],
  });
  const asset =
    value['asset'] === null ? null : parseArticleCoverAsset(value['asset']);
  const validated = parseApplicationImageUpload({
    id: value['id'],
    revision: value['revision'],
    status: value['status'],
    draftId: request.articleId,
    purpose: 'banner',
    source: request.source,
    createdAt: value['createdAt'],
    expiresAt: value['expiresAt'],
    asset: asset ? { ...asset, purpose: 'banner' } : null,
  });
  return {
    ...request,
    id: validated.id,
    revision: validated.revision,
    status: validated.status,
    createdAt: validated.createdAt,
    expiresAt: validated.expiresAt,
    asset,
  };
}
export function assertArticleCoverUploadWritable(
  upload: ArticleCoverUpload,
  revision: number,
  at: number
) {
  assertApplicationImageUploadWritable(imageUpload(upload), revision, at);
}
export function assertArticleCoverCancellation(
  upload: ArticleCoverUpload,
  revision: number,
  referenced: boolean
) {
  assertApplicationImageCancellation(imageUpload(upload), revision, referenced);
}
export function articleCoverRetirementReason(
  upload: ArticleCoverUpload,
  referenced: boolean,
  draftDeleted: boolean,
  at: number
) {
  return applicationImageRetirementReason(
    imageUpload(upload),
    referenced,
    draftDeleted,
    at
  );
}
