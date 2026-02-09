import { Collection, Document } from 'mongodb';
import { err, ok, Result } from '@foundation/standard';
import { IIdentityNode } from '@foundation/identity-system';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { IIdentityNodeRepository } from '@domains/identity/authentication';

type IdentityNodeDoc = Document & IIdentityNode;

export class MongoIdentityNodeRepository implements IIdentityNodeRepository {
  private readonly nodes: Collection<IdentityNodeDoc>;

  constructor(
    mongo: PlatformMongoClient,
    opts?: { nodesCollection?: string }
  ) {
    this.nodes = mongo.collection<IdentityNodeDoc>(opts?.nodesCollection ?? 'identity_nodes');
  }

  async createIfNotExists(node: IIdentityNode): Promise<Result<boolean, Error>> {
    try {
      await this.nodes.updateOne({ id: node.id } as any, { $setOnInsert: node } as any, { upsert: true });
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteById(id: string): Promise<Result<boolean, Error>> {
    try {
      await this.nodes.deleteOne({ id } as any);
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

