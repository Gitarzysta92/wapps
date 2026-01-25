import { Uuidv7 } from "@foundation/standard";

export interface IIdentityNode {
  id: Uuidv7;
  kind: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}