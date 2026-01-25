import { IDiscussionPayloadRepository } from '@domains/discussion';
import { err, ok, Result } from '@foundation/standard';
import { MinioClient } from '../../infrastructure/minio-client';

export const DISCUSSION_CONTENT_BUCKET_NAME = 'discussion-content';

export class MinioDiscussionPayloadRepository implements IDiscussionPayloadRepository {
  constructor(private readonly minioClient: MinioClient) {}

  async addPayload(discussionId: string, payload: unknown): Promise<Result<boolean, Error>> {
    try {
      const objectKey = `discussions/${discussionId}/content.json`;
      await this.minioClient.uploadJson(DISCUSSION_CONTENT_BUCKET_NAME, objectKey, payload, {
        discussionId,
      });
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

