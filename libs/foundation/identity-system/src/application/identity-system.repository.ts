import { Result, Uuidv7 } from '@foundation/standard';
import { IIdentityNode } from '../models/identity-node';
import { IIdentityNodeRelation } from '../models/identity-node-relation';

export interface IIdentityNodeRepository {
  addNode(n: IIdentityNode, relations?: IIdentityNodeRelation[]): Promise<Result<boolean, Error>>;
  updateNode(n: IIdentityNode, relations: IIdentityNodeRelation[]): Promise<Result<boolean, Error>>;
  deleteNode(n: IIdentityNode): Promise<Result<boolean, Error>>;

  getNode<T extends IIdentityNode>(id: Uuidv7): Promise<Result<T, Error>>;
  getNodesByKind<T extends IIdentityNode>(kind: string): Promise<Result<T[], Error>>;
}

