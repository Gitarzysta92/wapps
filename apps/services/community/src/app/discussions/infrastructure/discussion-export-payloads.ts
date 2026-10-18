import { createHash } from 'node:crypto';
import type { DiscussionPayloadReference } from '@apps/shared';
import { MinioClient } from '@sdk/extras/minio';
import { AccountExportSourceInvalid } from '@sdk/features/identity/core';
import type {
  DiscussionExportPayloadObservation,
  DiscussionExportPayloads,
} from '../application/discussion-export-payloads.port';
import { assertDiscussionPayloadReference } from '../application/registered-discussion-payloads';

export class MinioDiscussionExportPayloads implements DiscussionExportPayloads {
  constructor(private readonly minio: MinioClient) {}

  async read(
    nodeId: string,
    reference: DiscussionPayloadReference,
    signal: AbortSignal
  ): Promise<unknown> {
    const observed = await this.observe(nodeId, reference, signal);
    if (observed.kind === 'absent')
      throw new AccountExportSourceInvalid(
        'Confirmed discussion object is missing'
      );
    return observed.content;
  }

  async observe(
    nodeId: string,
    reference: DiscussionPayloadReference,
    signal: AbortSignal
  ): Promise<DiscussionExportPayloadObservation> {
    signal.throwIfAborted();
    try {
      assertDiscussionPayloadReference(nodeId, reference);
    } catch {
      throw new AccountExportSourceInvalid(
        'Invalid discussion object reference'
      );
    }
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    const timer = setTimeout(
      () =>
        controller.abort(new Error('Discussion export object read timed out')),
      10_000
    );
    try {
      let body: Buffer;
      try {
        body = await this.minio.getBytes(
          'discussion-content',
          reference.key,
          reference.bytes,
          controller.signal
        );
      } catch (error) {
        controller.signal.throwIfAborted();
        // A generic 404, missing bucket, denial or outage is not evidence of an absent upload.
        if (error instanceof Error && error.name === 'NoSuchKey')
          return { kind: 'absent' };
        throw error;
      }
      controller.signal.throwIfAborted();
      if (
        body.length !== reference.bytes ||
        createHash('sha256').update(body).digest('hex') !== reference.sha256
      )
        throw new AccountExportSourceInvalid(
          'Discussion export object integrity check failed'
        );
      try {
        const payload: unknown = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(body)
        );
        if (
          !payload ||
          typeof payload !== 'object' ||
          Array.isArray(payload) ||
          !('content' in payload)
        )
          throw new Error('Missing discussion content');
        // Legacy envelopes may contain internal metadata; only authored content is portable.
        return { kind: 'present', content: payload.content };
      } catch {
        throw new AccountExportSourceInvalid(
          'Invalid discussion export content'
        );
      }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
}
