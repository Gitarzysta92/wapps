import { Result } from '@foundation/standard';
import { IIdentityNode } from "../entities/identity-node";

export interface IIdentitySystemRepository {
  addIdentityNode(node: IIdentityNode): Promise<Result<boolean, Error>>;
  updateIdentityNode(node: IIdentityNode): Promise<Result<boolean, Error>>;
  deleteIdentityNode(node: IIdentityNode): Promise<Result<boolean, Error>>;
  getIdentityNode<T extends IIdentityNode>(id: string): Promise<Result<T, Error>>;
  getIdentityNodes<T extends IIdentityNode>(): Promise<Result<T[], Error>>;
}