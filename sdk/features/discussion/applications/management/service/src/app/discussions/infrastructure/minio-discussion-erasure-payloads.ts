import type { DiscussionPayloadReference } from '@apps/shared';
import type { MinioClient } from '@sdk/extras/minio';
import type { DiscussionErasurePayloads } from '../application/anonymize-discussion-contributions';
import { MinioDiscussionExportPayloads } from './discussion-export-payloads';
import { MinioDiscussionPayloadInventory } from './minio-discussion-payload-inventory';

export class MinioDiscussionErasurePayloads
  implements DiscussionErasurePayloads
{
  private readonly reader: MinioDiscussionExportPayloads;
  private readonly copies: MinioDiscussionPayloadInventory;
  constructor(minio: MinioClient) {
    this.reader = new MinioDiscussionExportPayloads(minio);
    this.copies = new MinioDiscussionPayloadInventory(minio);
  }
  read(
    nodeId: string,
    reference: DiscussionPayloadReference,
    signal: AbortSignal
  ): Promise<unknown> {
    return this.reader.read(nodeId, reference, signal);
  }
  put(reference: DiscussionPayloadReference, body: Buffer): Promise<void> {
    return this.copies.copy(reference, body);
  }
}
