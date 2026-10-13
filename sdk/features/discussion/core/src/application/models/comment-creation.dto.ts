import {
  ContentNodeState,
  ContentNodeVisibility,
} from '@foundation/content-system';
import { Uuidv7 } from '@sdk/kernel/standard';

export type CommentCreationDto = {
  content: string;
  subjectId: Uuidv7;
  state?: ContentNodeState;
  visibility?: ContentNodeVisibility;
};
