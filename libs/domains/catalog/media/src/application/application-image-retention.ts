import {
  ApplicationImageConflictError,
  applicationImageInteger,
  type ApplicationImageUpload,
} from './application-image';

export const APPLICATION_IMAGE_UNUSED_LIFETIME = 7 * 24 * 60 * 60 * 1000;
export type ApplicationImageRetirementReason =
  | 'cancelled'
  | 'expired'
  | 'unreferenced'
  | 'draft-deleted';

export function assertApplicationImageCancellation(
  upload: ApplicationImageUpload,
  expectedRevision: number,
  referenced: boolean
) {
  applicationImageInteger(expectedRevision);
  if (
    upload.status === 'cancelled' ||
    upload.revision !== expectedRevision ||
    !Number.isSafeInteger(upload.revision + 1)
  )
    throw new ApplicationImageConflictError(
      'The upload changed. Reload before cancelling it.'
    );
  if (referenced)
    throw new ApplicationImageConflictError(
      'This image is still used by a draft, submission or publication. Remove its references before cancelling it.'
    );
}

export function applicationImageRetirementReason(
  upload: ApplicationImageUpload,
  referenced: boolean,
  draftDeleted: boolean,
  at: number
): ApplicationImageRetirementReason | null {
  applicationImageInteger(at, 8_640_000_000_000_000);
  if (upload.status === 'cancelled' || referenced || at < upload.createdAt)
    return null;
  if (draftDeleted) return 'draft-deleted';
  if (upload.status === 'pending' && at >= upload.expiresAt) return 'expired';
  if (
    upload.status === 'ready' &&
    at - upload.createdAt >= APPLICATION_IMAGE_UNUSED_LIFETIME
  )
    return 'unreferenced';
  return null;
}
