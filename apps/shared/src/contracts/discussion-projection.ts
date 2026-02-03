/**
 * Cross-service messaging contract for discussion materialization/projection.
 *
 * Keep transport-specific topology names (queues/topics) and message schemas here,
 * so domain libraries stay free of infrastructure details.
 */
export const DISCUSSION_PROJECTION_QUEUE_NAME = 'discussion-projection';

export type DiscussionMaterializationRequestedEvent = {
  type: 'discussion.materialization.requested';
  discussionId: string;
  timestamp: number;
};

