import { Uuidv7 } from "@sdk/kernel/standard";

export interface IWorkflowNode {
  id: Uuidv7;
  kind: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}
