/**
 * Cross-service messaging contract for discussion materialization/projection.
 *
 * Keep transport-specific topology names (queues/topics) and message schemas here,
 * so domain libraries stay free of infrastructure details.
 */
import { EventEnvelope } from '@cross-cutting/events';

export const DISCUSSION_PROJECTION_QUEUE_NAME = 'discussion-projection';

export type DiscussionMaterializationRequestedEvent = EventEnvelope<
  'discussion.materialization.requested',
  { discussionId: string }
>;

