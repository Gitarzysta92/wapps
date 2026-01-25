import { Uuidv7 } from '@foundation/standard';
import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';

export type DiscussionCreationDto = {
  subjectId?: Uuidv7;
  state?: ContentNodeState;
  visibility?: ContentNodeVisibility;
};
