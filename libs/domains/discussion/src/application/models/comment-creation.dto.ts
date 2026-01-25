import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';
import { Uuidv7 } from '@foundation/standard';

export type CommentCreationDto = {
  subjectId: Uuidv7;
  state?: ContentNodeState;
  visibility?: ContentNodeVisibility;
};
