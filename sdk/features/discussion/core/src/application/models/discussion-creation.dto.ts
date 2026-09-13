import { Uuidv7 } from '@foundation/standard';
import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';

export type DiscussionCreationDto = {
  /**
   * Optional deterministic identifiers (used for seeding).
   */
  id?: Uuidv7;
  referenceKey?: Uuidv7;
  /**
   * Discussion body content. Stored as payload (e.g. MinIO) by the app layer.
   */
  content: unknown;
  subjectId?: Uuidv7;
  state?: ContentNodeState;
  visibility?: ContentNodeVisibility;
};
