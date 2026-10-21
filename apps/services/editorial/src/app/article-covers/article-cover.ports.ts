import type {
  ArticleCoverAsset,
  ArticleCoverSourceType,
  ArticleCoverUpload,
  ArticleCoverUploadInput,
  ArticleCoverUploadReceipt,
} from '@domains/catalog/media';
import type { EditorialActor } from '../application/editorial.ports';

export interface ArticleCoverCommand {
  actor: EditorialActor;
  id: string;
  key: string;
  fingerprint: string;
  at: number;
}
export interface ArticleCoverCreateCommand extends ArticleCoverCommand {
  input: ArticleCoverUploadInput;
}
export interface ArticleCoverContentCommand extends ArticleCoverCommand {
  expectedRevision: number;
  sourceSha256: string;
  sourceBytes: number;
}
export interface ArticleCoverCancelCommand extends ArticleCoverCommand {
  expectedRevision: number;
}
export type ArticleCoverReservation =
  | { receipt: ArticleCoverUploadReceipt }
  | { upload: ArticleCoverUpload; lease: string };

export interface ArticleCoverStore {
  list(
    actor: EditorialActor,
    articleId: string,
    at: number
  ): Promise<ArticleCoverUpload[]>;
  cancel(
    command: ArticleCoverCancelCommand
  ): Promise<ArticleCoverUploadReceipt>;
  create(
    command: ArticleCoverCreateCommand
  ): Promise<ArticleCoverUploadReceipt>;
  read(actor: EditorialActor, id: string): Promise<ArticleCoverUpload>;
  reserve(
    command: ArticleCoverContentCommand
  ): Promise<ArticleCoverReservation>;
  complete(
    command: ArticleCoverContentCommand,
    lease: string,
    asset: ArticleCoverAsset,
    at: number
  ): Promise<ArticleCoverUploadReceipt>;
  fail(
    command: ArticleCoverContentCommand,
    lease: string,
    at: number
  ): Promise<void>;
}
export interface ArticleCoverNormalizer {
  normalize(
    bytes: Uint8Array,
    contentType: ArticleCoverSourceType
  ): Promise<{
    bytes: Uint8Array;
    width: number;
    height: number;
  }>;
}
export interface ArticleCoverObjects {
  /** A conflicting existing object must be rejected, never overwritten. */
  putImmutable(asset: ArticleCoverAsset, bytes: Uint8Array): Promise<void>;
  read(asset: ArticleCoverAsset, signal?: AbortSignal): Promise<Uint8Array>;
}
export interface ArticleCoverRetirementObjects {
  /** Reclaim retired bytes while keeping a permanent marker that fences late conditional uploads. */
  retire(id: string): Promise<void>;
}
