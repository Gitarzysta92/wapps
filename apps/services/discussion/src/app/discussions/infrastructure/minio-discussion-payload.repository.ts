import { IDiscussionPayloadRepository } from '@domains/discussion';
import { err, ok, Result } from '@foundation/standard';
import { MinioClient } from '../../infrastructure/minio-client';

export const DISCUSSION_CONTENT_BUCKET_NAME = 'discussion-content';
const DISCUSSION_PAYLOAD_PREFIX = 'discussions/';
const DISCUSSION_PAYLOAD_SUFFIX = '/content';

export class MinioDiscussionPayloadRepository implements IDiscussionPayloadRepository {
  constructor(private readonly minioClient: MinioClient) {}

  async addPayload(discussionId: string, payload: unknown): Promise<Result<boolean, Error>> {
    try {
      const objectKey = `discussions/${discussionId}/content`;
      await this.minioClient.uploadJson(DISCUSSION_CONTENT_BUCKET_NAME, objectKey, payload, {
        discussionId,
      });
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async listAllPayloads<T = unknown>(): Promise<Result<T[], Error>> {
    try {
      const keys = await this.minioClient.listObjectKeys(DISCUSSION_CONTENT_BUCKET_NAME, DISCUSSION_PAYLOAD_PREFIX);
      const payloadKeys = keys.filter((k: string) => k.endsWith(DISCUSSION_PAYLOAD_SUFFIX));

      const payloads = await Promise.all(
        payloadKeys.map((k: string) => this.minioClient.getJson<T>(DISCUSSION_CONTENT_BUCKET_NAME, k))
      );

      return ok(payloads);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getPayload<T = unknown>(discussionId: string): Promise<Result<T, Error>> {
    try {
      const objectKey = `discussions/${discussionId}/content`;
      const payload = await this.minioClient.getJson<T>(DISCUSSION_CONTENT_BUCKET_NAME, objectKey);
      return ok(payload);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async updatePayload(
    discussionId: string,
    patch: Record<string, unknown>
  ): Promise<Result<boolean, Error>> {
    try {
      const objectKey = `discussions/${discussionId}/content`;
      const current = await this.minioClient.getJson<unknown>(DISCUSSION_CONTENT_BUCKET_NAME, objectKey);
      const base =
        typeof current === 'object' && current !== null ? (current as Record<string, unknown>) : {};
      const next = { ...base, ...patch };
      await this.minioClient.uploadJson(DISCUSSION_CONTENT_BUCKET_NAME, objectKey, next, { discussionId });
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deletePayload(discussionId: string): Promise<Result<boolean, Error>> {
    try {
      const objectKey = `discussions/${discussionId}/content`;
      await this.minioClient.deleteObject(DISCUSSION_CONTENT_BUCKET_NAME, objectKey);
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

