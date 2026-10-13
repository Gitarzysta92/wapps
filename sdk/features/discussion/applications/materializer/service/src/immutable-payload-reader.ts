import type { DiscussionPayloadReference } from '@apps/shared';
import { DISCUSSION_MAX_PAYLOAD_BYTES } from '@apps/shared';
import { MinioClient } from '@sdk/extras/minio';
import {
  ImmutablePayloadReader,
  InvalidSnapshotError,
} from './materialization';

export class MinioImmutablePayloadReader implements ImmutablePayloadReader {
  constructor(private readonly minio: MinioClient) {}
  read(reference: DiscussionPayloadReference): Promise<Buffer> {
    if (
      !/^discussions\/[0-9a-f-]{36}\/versions\/[0-9a-f-]{36}\.json$/.test(
        reference.key
      )
    ) {
      throw new InvalidSnapshotError('Invalid immutable object key');
    }
    return this.minio.getBytes(
      'discussion-content',
      reference.key,
      Math.min(reference.bytes, DISCUSSION_MAX_PAYLOAD_BYTES)
    );
  }
}
