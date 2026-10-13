import type {
  ApplicationImageAsset,
  ApplicationImagePurpose,
  ApplicationImageSourceType,
  ApplicationImageUpload,
  ApplicationImageUploadInput,
  ApplicationImageUploadReceipt,
} from '@domains/catalog/media';
import type { EditorialActor } from '../application/editorial.ports';

export interface ApplicationImageCommand {
  actor: EditorialActor;
  id: string;
  key: string;
  fingerprint: string;
  at: number;
}
export interface ApplicationImageCreateCommand extends ApplicationImageCommand {
  input: ApplicationImageUploadInput;
}
export interface ApplicationImageContentCommand
  extends ApplicationImageCommand {
  expectedRevision: number;
  sourceSha256: string;
  sourceBytes: number;
}
export interface ApplicationImageCancelCommand extends ApplicationImageCommand {
  expectedRevision: number;
}
export type ApplicationImageReservation =
  | { receipt: ApplicationImageUploadReceipt }
  | { upload: ApplicationImageUpload; lease: string };

export interface ApplicationImageStore {
  list(
    actor: EditorialActor,
    draftId: string,
    at: number
  ): Promise<ApplicationImageUpload[]>;
  cancel(
    command: ApplicationImageCancelCommand
  ): Promise<ApplicationImageUploadReceipt>;
  create(
    command: ApplicationImageCreateCommand
  ): Promise<ApplicationImageUploadReceipt>;
  read(actor: EditorialActor, id: string): Promise<ApplicationImageUpload>;
  reserve(
    command: ApplicationImageContentCommand
  ): Promise<ApplicationImageReservation>;
  complete(
    command: ApplicationImageContentCommand,
    lease: string,
    asset: ApplicationImageAsset,
    at: number
  ): Promise<ApplicationImageUploadReceipt>;
  fail(
    command: ApplicationImageContentCommand,
    lease: string,
    at: number
  ): Promise<void>;
}
export interface ApplicationImageNormalizer {
  normalize(
    bytes: Uint8Array,
    purpose: ApplicationImagePurpose,
    contentType: ApplicationImageSourceType
  ): Promise<{
    bytes: Uint8Array;
    width: number;
    height: number;
  }>;
}
export interface ApplicationImageObjects {
  /** A conflicting existing object must be rejected, never overwritten. */
  putImmutable(asset: ApplicationImageAsset, bytes: Uint8Array): Promise<void>;
  read(asset: ApplicationImageAsset, signal?: AbortSignal): Promise<Uint8Array>;
}
export interface ApplicationImageRetirementObjects {
  /** Reclaim retired bytes while keeping a permanent marker that fences late conditional uploads. */
  retire(id: string): Promise<void>;
}
