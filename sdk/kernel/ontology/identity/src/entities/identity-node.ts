import { Uuidv7 } from "@sdk/kernel/standard";

export interface IIdentityNode {
  id: Uuidv7;
  kind: string;
  isActive: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}