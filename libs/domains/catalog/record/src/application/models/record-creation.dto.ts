import { Uuidv7 } from "@foundation/standard";
import { ContentNodeState, ContentNodeVisibility } from "@foundation/content-system";

export type RecordCreationDto = {
  slug: string;
  name: string;
  description: string;
  categoryId: Uuidv7;
  tagIds: Uuidv7[];
  platformIds: Uuidv7[];
  state: ContentNodeState;
  visibility: ContentNodeVisibility;
}