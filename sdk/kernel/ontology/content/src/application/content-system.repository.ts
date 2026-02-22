import { Result, Uuidv7 } from "@sdk/kernel/standard";
import { IContentNode } from "./models/content-node";
import { ContentNodeState, ContentNodeVisibility } from "./constants";
import { IContentNodeRelation } from "./models/content-node-relation";

export interface IContentNodeRepository {
  addNode(c: IContentNode, relations?: IContentNodeRelation[]): Promise<Result<boolean, Error>>;
  updateNode(c: IContentNode, relations: IContentNodeRelation[]): Promise<Result<boolean, Error>>;
  deleteNode(c: IContentNode): Promise<Result<boolean, Error>>;
  getNode<T extends IContentNode>(id: Uuidv7): Promise<Result<T, Error>>;
  getNodesByKind<T extends IContentNode>(kind: string): Promise<Result<T[], Error>>;
  getNodesByState<T>(state: ContentNodeState): Promise<Result<T[], Error>>;
  getNodesByVisibility<T extends IContentNode>(visibility: ContentNodeVisibility): Promise<Result<T[], Error>>;
}