import { MinioClient } from '@infrastructure/minio';

const DISCUSSION_CONTENT_BUCKET_NAME = 'discussion-content';

export async function loadDiscussionPayload(minio: MinioClient, nodeId: string): Promise<unknown> {
  // Convention currently used by discussion service:
  // discussions/${id}/content
  const key = `discussions/${nodeId}/content`;
  return await minio.getJson(DISCUSSION_CONTENT_BUCKET_NAME, key);
}

