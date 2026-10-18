import type { DiscussionPayloadReference } from '@apps/shared';

export type DiscussionExportPayloadObservation =
  | { kind: 'present'; content: unknown }
  | { kind: 'absent' };

export interface DiscussionExportPayloads {
  read(
    nodeId: string,
    reference: DiscussionPayloadReference,
    signal: AbortSignal
  ): Promise<unknown>;
  /** Only an unconfirmed reservation may treat observed object absence as a valid capture. */
  observe(
    nodeId: string,
    reference: DiscussionPayloadReference,
    signal: AbortSignal
  ): Promise<DiscussionExportPayloadObservation>;
}
