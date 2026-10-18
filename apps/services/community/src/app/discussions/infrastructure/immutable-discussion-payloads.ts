import { createHash } from 'node:crypto';
import { MinioClient } from '@sdk/extras/minio';
import type { DiscussionPayloadReference } from '@apps/shared';
import {
  assertDiscussionPayloadReference,
  type DiscussionPayloadObjects,
} from '../application/registered-discussion-payloads';

export class MinioDiscussionPayloadObjects implements DiscussionPayloadObjects {
  constructor(private readonly minio: MinioClient) {}

  async put(reference: DiscussionPayloadReference, body: Buffer) {
    assertDiscussionPayloadReference(reference.key.split('/')[1], reference);
    if (
      body.length !== reference.bytes ||
      createHash('sha256').update(body).digest('hex') !== reference.sha256
    )
      throw new Error('Discussion bytes disagree with their reservation');
    await this.minio.putImmutableBytes(
      'discussion-content',
      reference.key,
      body
    );
  }

  async retire(reference: DiscussionPayloadReference) {
    assertDiscussionPayloadReference(reference.key.split('/')[1], reference);
    await this.minio.retireImmutableBytes('discussion-content', reference.key);
  }
}
