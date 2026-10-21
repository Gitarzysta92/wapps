import type { DataSource } from 'typeorm';
import { readonlyMysqlSnapshot } from '@sdk/extras/mysql';
import {
  AccountExportCaptureSequence,
  CanonicalIdentityAccessDenied,
  isCanonicalIdentityId,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import type { AccountExportSource } from '@sdk/features/identity/libs/management';
import { captureEditorialDrafts } from './editorial-export-drafts';
import { captureEditorialOwnership } from './editorial-export-ownership';
import { captureEditorialPublications } from './editorial-export-publications';
import {
  captureEditorialMedia,
  type EditorialExportImages,
} from './editorial-export-media';

/** One private canonical snapshot across the exact owner's tenants; no projections or public audience filters. */
export class MysqlEditorialAccountExportSource implements AccountExportSource {
  readonly name = 'editorial';
  constructor(
    private readonly source: DataSource,
    private readonly images: EditorialExportImages,
    private readonly now = Date.now
  ) {}

  async *capture(
    identityId: string,
    signal: AbortSignal
  ): AsyncIterable<AccountExportEntry> {
    if (!isCanonicalIdentityId(identityId))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    const sequence = new AccountExportCaptureSequence(this.name);
    let records = 0;
    const entry = (collection: string, data: unknown) => {
      const result = sequence.accept({
        type: 'record',
        source: this.name,
        collection,
        data,
      });
      records++;
      return result;
    };
    const images = this.images,
      startedAt = this.now();
    yield* readonlyMysqlSnapshot(this.source, signal, async function* (reader) {
      await reader.query(
        'SELECT resourceId FROM editorial_resource_states WHERE ownerIdentityId = ? LIMIT 1',
        [identityId]
      );
      yield sequence.accept({
        type: 'begin',
        source: 'editorial',
        at: startedAt,
      });
      const context = { reader, owner: identityId, signal, entry };
      yield* captureEditorialDrafts(context);
      yield* captureEditorialOwnership(context);
      yield* captureEditorialPublications(context);
      yield* captureEditorialMedia(context, images);
    });
    signal.throwIfAborted();
    yield sequence.accept({
      type: 'end',
      source: this.name,
      at: this.now(),
      records,
    });
  }
}
