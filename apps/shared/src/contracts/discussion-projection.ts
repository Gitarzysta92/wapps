/**
 * Cross-service messaging contract for discussion materialization/projection.
 *
 * Keep transport-specific topology names (queues/topics) and message schemas here,
 * so domain libraries stay free of infrastructure details.
 */
import { EventEnvelope } from '@sdk/kernel/aspects/events';

export const DISCUSSION_PROJECTION_QUEUE_NAME = 'discussion-projection';

/** Versioned writers/readers use an independent queue during legacy backfill. */
export const DISCUSSION_GENERATION_QUEUE_NAME = 'discussion-projection-v2';
export const DISCUSSION_GENERATION_DEAD_LETTER_QUEUE =
  'discussion-projection-v2.failed';

export type DiscussionGenerationRequestedEvent = EventEnvelope<
  'discussion.materialization.requested',
  { discussionId: string; revision: number }
>;

export type DiscussionMaterializationRequestedEvent = EventEnvelope<
  'discussion.materialization.requested',
  { discussionId: string }
>;
