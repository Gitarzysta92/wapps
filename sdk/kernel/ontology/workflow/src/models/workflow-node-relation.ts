import { Uuidv7 } from "@sdk/kernel/standard";

export interface IWorkflowNodeRelation {
  id: Uuidv7;
  fromWorkflowId: Uuidv7;
  toWorkflowId: Uuidv7;
  relationType: string;
  createdAt: number;
}
