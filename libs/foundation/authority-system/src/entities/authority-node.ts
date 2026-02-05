import { Uuidv7 } from "@foundation/standard";

export interface IAuthorityNode {
  id: Uuidv7;
  referenceKey: Uuidv7;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
}


