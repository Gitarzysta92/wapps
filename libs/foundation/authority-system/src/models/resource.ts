import { Uuidv7 } from "@foundation/standard";

export interface IContentNodeRelation {
  id: Uuidv7;
  fromContentId: Uuidv7;
  toContentId: Uuidv7;
  relationType: string;
  createdAt: number;
}

