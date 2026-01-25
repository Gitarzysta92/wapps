import { Uuidv7 } from '@foundation/standard';
import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';

export type DiscussionCreationDto = {
  /**
   * Discussion body content. Stored as payload (e.g. MinIO) by the app layer.
   */
  content: unknown;
  subjectId?: Uuidv7;
  state?: ContentNodeState;
  visibility?: ContentNodeVisibility;
};
