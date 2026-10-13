export const APPLICATION_IMAGE_SOURCE_LIMIT = 8 * 1024 * 1024;
export const APPLICATION_IMAGE_OUTPUT_LIMIT = 8 * 1024 * 1024;
export const APPLICATION_IMAGE_PIXEL_LIMIT = 20_000_000;
export const APPLICATION_IMAGE_DIMENSION_LIMIT = 8192;
export const APPLICATION_IMAGE_UPLOAD_LIFETIME = 24 * 60 * 60 * 1000;
export const APPLICATION_IMAGE_PENDING_LIMIT = 20;
export const APPLICATION_IMAGE_DAILY_LIMIT = 100;
export const APPLICATION_IMAGE_RETAINED_LIMIT = 200;
export const APPLICATION_IMAGE_ATTEMPT_LIMIT = 10;
export const APPLICATION_IMAGE_OUTPUT_BOUNDS = {
  logo: { width: 1024, height: 1024 },
  banner: { width: 2560, height: 1440 },
} as const;

export type ApplicationImagePurpose =
  keyof typeof APPLICATION_IMAGE_OUTPUT_BOUNDS;
export type ApplicationImageSourceType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp';
export type ApplicationImageUploadStatus = 'pending' | 'ready' | 'cancelled';
export interface ApplicationImageSource {
  contentType: ApplicationImageSourceType;
  bytes: number;
  sha256: string;
}
export interface ApplicationImageUploadInput {
  draftId: string;
  purpose: ApplicationImagePurpose;
  source: ApplicationImageSource;
}
export interface ApplicationImageAsset {
  id: string;
  purpose: ApplicationImagePurpose;
  contentType: 'image/webp';
  bytes: number;
  sha256: string;
  width: number;
  height: number;
}
export interface ApplicationImageUpload extends ApplicationImageUploadInput {
  id: string;
  revision: number;
  status: ApplicationImageUploadStatus;
  createdAt: number;
  expiresAt: number;
  asset: ApplicationImageAsset | null;
}
export interface ApplicationImageUploadReceipt {
  id: string;
  revision: number;
  status: ApplicationImageUploadStatus;
}
export class ApplicationImageInputError extends Error {}
export class ApplicationImageConflictError extends Error {}
export class ApplicationImageNotFoundError extends Error {}
export class ApplicationImageUnavailableError extends Error {}
export class ApplicationImageRateLimitError extends Error {}

export function applicationImageObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new ApplicationImageInputError('Invalid image fields');
  return input as Record<string, unknown>;
}
export function applicationImageId(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input
    )
  )
    throw new ApplicationImageInputError('Invalid image identity');
  return input;
}
export function applicationImageInteger(
  input: unknown,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < 1 ||
    input > maximum
  )
    throw new ApplicationImageInputError(
      'Invalid image size, revision or timestamp'
    );
  return input;
}
export function applicationImagePurpose(
  input: unknown
): ApplicationImagePurpose {
  if (input !== 'logo' && input !== 'banner')
    throw new ApplicationImageInputError(
      'Choose an application logo or banner'
    );
  return input;
}
export function applicationImageDigest(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{64}$/.test(input))
    throw new ApplicationImageInputError(
      'A complete image SHA-256 digest is required'
    );
  return input;
}
export function parseApplicationImageSource(
  input: unknown
): ApplicationImageSource {
  const value = applicationImageObject(input, [
    'contentType',
    'bytes',
    'sha256',
  ]);
  const contentType = value['contentType'];
  if (
    contentType !== 'image/png' &&
    contentType !== 'image/jpeg' &&
    contentType !== 'image/webp'
  )
    throw new ApplicationImageInputError('Upload a PNG, JPEG or WebP image');
  return {
    contentType,
    bytes: applicationImageInteger(
      value['bytes'],
      APPLICATION_IMAGE_SOURCE_LIMIT
    ),
    sha256: applicationImageDigest(value['sha256']),
  };
}
export function parseApplicationImageUploadInput(
  input: unknown
): ApplicationImageUploadInput {
  const value = applicationImageObject(input, ['draftId', 'purpose', 'source']);
  return {
    draftId: applicationImageId(value['draftId']),
    purpose: applicationImagePurpose(value['purpose']),
    source: parseApplicationImageSource(value['source']),
  };
}
export function parseApplicationImageAsset(
  input: unknown
): ApplicationImageAsset {
  const value = applicationImageObject(input, [
    'id',
    'purpose',
    'contentType',
    'bytes',
    'sha256',
    'width',
    'height',
  ]);
  const purpose = applicationImagePurpose(value['purpose']);
  if (value['contentType'] !== 'image/webp')
    throw new ApplicationImageInputError('Invalid normalized image format');
  return {
    id: applicationImageId(value['id']),
    purpose,
    contentType: 'image/webp',
    bytes: applicationImageInteger(
      value['bytes'],
      APPLICATION_IMAGE_OUTPUT_LIMIT
    ),
    sha256: applicationImageDigest(value['sha256']),
    width: applicationImageInteger(
      value['width'],
      APPLICATION_IMAGE_OUTPUT_BOUNDS[purpose].width
    ),
    height: applicationImageInteger(
      value['height'],
      APPLICATION_IMAGE_OUTPUT_BOUNDS[purpose].height
    ),
  };
}
export function parseApplicationImageUploadReceipt(
  input: unknown
): ApplicationImageUploadReceipt {
  const value = applicationImageObject(input, ['id', 'revision', 'status']);
  const status = value['status'];
  if (status !== 'pending' && status !== 'ready' && status !== 'cancelled')
    throw new ApplicationImageInputError('Invalid image upload status');
  return {
    id: applicationImageId(value['id']),
    revision: applicationImageInteger(value['revision']),
    status,
  };
}
export function parseApplicationImageUpload(
  input: unknown
): ApplicationImageUpload {
  const value = applicationImageObject(input, [
    'id',
    'revision',
    'status',
    'draftId',
    'purpose',
    'source',
    'createdAt',
    'expiresAt',
    'asset',
  ]);
  const receipt = parseApplicationImageUploadReceipt({
    id: value['id'],
    revision: value['revision'],
    status: value['status'],
  });
  const request = parseApplicationImageUploadInput({
    draftId: value['draftId'],
    purpose: value['purpose'],
    source: value['source'],
  });
  const createdAt = applicationImageInteger(
    value['createdAt'],
    8_640_000_000_000_000
  );
  const expiresAt = applicationImageInteger(
    value['expiresAt'],
    8_640_000_000_000_000
  );
  if (expiresAt - createdAt !== APPLICATION_IMAGE_UPLOAD_LIFETIME)
    throw new ApplicationImageInputError('Invalid upload reservation lifetime');
  const asset =
    value['asset'] === null ? null : parseApplicationImageAsset(value['asset']);
  if (
    (receipt.status === 'ready') !== (asset !== null) ||
    (asset && (asset.id !== receipt.id || asset.purpose !== request.purpose))
  )
    throw new ApplicationImageInputError(
      'Image upload does not match its immutable asset'
    );
  return { ...receipt, ...request, createdAt, expiresAt, asset };
}
export function assertApplicationImageUploadWritable(
  upload: ApplicationImageUpload,
  expectedRevision: number,
  at: number
) {
  applicationImageInteger(expectedRevision);
  applicationImageInteger(at, 8_640_000_000_000_000);
  if (
    upload.status !== 'pending' ||
    upload.revision !== expectedRevision ||
    at >= upload.expiresAt ||
    at < upload.createdAt
  )
    throw new ApplicationImageConflictError(
      'The upload changed or expired. Reload before continuing.'
    );
}
