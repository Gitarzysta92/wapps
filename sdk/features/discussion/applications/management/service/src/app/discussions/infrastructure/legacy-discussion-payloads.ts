import { DISCUSSION_MAX_PAYLOAD_BYTES } from '@apps/shared';
import { MinioClient } from '@sdk/extras/minio';
import { LegacyDiscussionPayloads } from '../application/legacy-discussion-backfill';

export class MinioLegacyDiscussionPayloads implements LegacyDiscussionPayloads {
  constructor(private readonly minio: MinioClient) {}

  read(nodeId: string): Promise<Buffer> {
    return this.minio.getBytes(
      'discussion-content',
      `discussions/${nodeId}/content`,
      DISCUSSION_MAX_PAYLOAD_BYTES
    );
  }
}
