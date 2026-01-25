import { Uuidv7 } from "@foundation/standard";

export interface IContentNode {
  id: Uuidv7;
  referenceKey: Uuidv7;
  kind: string;
  state: string;
  visibility: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}