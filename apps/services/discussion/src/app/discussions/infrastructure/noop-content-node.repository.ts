import { IContentNodeRepository, IContentNodeRelation, IContentNode } from '@foundation/content-system';
import { err, ok, Result, Uuidv7 } from '@foundation/standard';
import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';

/**
 * Temporary stub until content-system persistence is wired in this service.
 */
export class NoopContentNodeRepository implements IContentNodeRepository {
  async addNode(_c: IContentNode, _relations?: IContentNodeRelation[]): Promise<Result<boolean, Error>> {
    return ok(true);
  }

  async updateNode(_c: IContentNode, _relations: IContentNodeRelation[]): Promise<Result<boolean, Error>> {
    return ok(true);
  }

  async deleteNode(_c: IContentNode): Promise<Result<boolean, Error>> {
    return ok(true);
  }

  async getNode<T extends IContentNode>(_id: Uuidv7): Promise<Result<T, Error>> {
    return err(new Error('Not implemented'));
  }

  async getNodesByKind<T extends IContentNode>(_kind: string): Promise<Result<T[], Error>> {
    return err(new Error('Not implemented'));
  }

  async getNodesByState<T>(_state: ContentNodeState): Promise<Result<T[], Error>> {
    return err(new Error('Not implemented'));
  }

  async getNodesByVisibility<T extends IContentNode>(
    _visibility: ContentNodeVisibility
  ): Promise<Result<T[], Error>> {
    return err(new Error('Not implemented'));
  }
}

