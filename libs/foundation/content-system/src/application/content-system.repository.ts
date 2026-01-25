import { Result, Uuidv7 } from "@foundation/standard";
import { IContentNode } from "./models/content-node";
import { ContentNodeState, ContentNodeVisibility } from "./constants";
import { IContentNodeRelation } from "./models/content-node-relation";

export abstract class ContentSystemRepository {
  abstract addNode(c: IContentNode, relations: IContentNodeRelation[]): Promise<Result<boolean, Error>>;
  abstract updateNode(c: IContentNode, relations: IContentNodeRelation[]): Promise<Result<boolean, Error>>;
  abstract deleteNode(c: IContentNode): Promise<Result<boolean, Error>>;
  abstract getNode<T extends IContentNode>(id: Uuidv7): Promise<Result<T, Error>>;
  abstract getNodesByKind<T extends IContentNode>(kind: string): Promise<Result<T[], Error>>;
  abstract getNodesByState<T>(state: ContentNodeState): Promise<Result<T[], Error>>;
  abstract getNodesByVisibility<T extends IContentNode>(visibility: ContentNodeVisibility): Promise<Result<T[], Error>>;
}