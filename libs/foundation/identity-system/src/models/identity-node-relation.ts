import { Uuidv7 } from "@foundation/standard";

export interface IIdentityNodeRelation {
  id: Uuidv7;
  fromIdentityId: Uuidv7;
  toIdentityId: Uuidv7;
  relationType: string;
  createdAt: number;
}

