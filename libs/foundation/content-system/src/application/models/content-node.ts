import { ContentNodeState, ContentNodeVisibility } from "../constants";
import { Uuidv7 } from "@foundation/standard";

export interface IContentNode {
  id: Uuidv7;
  referenceKey: Uuidv7;
  kind: string;
  state: ContentNodeState;
  visibility: ContentNodeVisibility;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
}