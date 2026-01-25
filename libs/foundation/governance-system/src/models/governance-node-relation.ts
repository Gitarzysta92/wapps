import { Uuidv7 } from "@foundation/standard";

export interface IGovernanceNodeRelation {
  id: Uuidv7;
  fromGovernanceId: Uuidv7;
  toGovernanceId: Uuidv7;
  relationType: string;
  createdAt: number;
}
