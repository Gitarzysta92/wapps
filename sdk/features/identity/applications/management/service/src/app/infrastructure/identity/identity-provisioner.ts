import { v7 as uuidv7 } from 'uuid';
import { Collection, Document } from 'mongodb';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  identitySubjectId,
  IIdentityNode,
  IIdentityNodeRelation,
  IIdentitySubjectRepository,
} from '@sdk/kernel/ontology/identity';
import { PlatformMongoClient } from '@infrastructure/mongo';
import {
  IdentityService,
  IIdentityIdGenerator,
  IIdentityNodeRepository,
} from '@domains/identity/authentication';

export type EnsureIdentityResult = {
  identityId: string;
  subjectId: string;
  created: boolean;
};

type IdentityNodeDoc = Document & IIdentityNode;
type IdentityRelationDoc = Document & IIdentityNodeRelation;

class MongoIdentityNodeRepository implements IIdentityNodeRepository {
  constructor(private readonly nodes: Collection<IdentityNodeDoc>) {}

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

export class IdentityProvisioner {
  private readonly nodes: Collection<IdentityNodeDoc>;
  private readonly relations: Collection<IdentityRelationDoc>;
  private readonly subjectsRepo: IIdentitySubjectRepository;
  private readonly linking: IdentityService;

  constructor(
    mongo: PlatformMongoClient,
    subjectsRepo: IIdentitySubjectRepository,
    opts?: { nodesCollection?: string; relationsCollection?: string }
  ) {
    this.nodes = mongo.collection<IdentityNodeDoc>(opts?.nodesCollection ?? 'identity_nodes');
    this.relations = mongo.collection<IdentityRelationDoc>(opts?.relationsCollection ?? 'identity_relations');
    this.subjectsRepo = subjectsRepo;

    const nodesRepo = new MongoIdentityNodeRepository(this.nodes);
    const ids: IIdentityIdGenerator = { generate: () => uuidv7() };
    this.linking = new IdentityService(nodesRepo, subjectsRepo, ids);
  }

  async ensureForFirebaseUid(uid: string): Promise<Result<EnsureIdentityResult, Error>> {
    try {
      const r = await this.linking.addIdentityNode('firebase', uid);
      if (!r.ok) return err(r.error);
      return ok({ identityId: r.value.identityId, subjectId: r.value.subjectId, created: r.value.created });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteByFirebaseUid(uid: string): Promise<Result<boolean, Error>> {
    const provider = 'firebase';
    const subjectId = identitySubjectId(provider, uid);
    try {
      const subject = await this.subjectsRepo.getByProviderExternalId(provider, uid);
      if (!subject.ok) return err(subject.error);

      await this.subjectsRepo.deleteById(subjectId);

      const identityId = subject.value?.identityId;
      if (identityId) {
        await this.nodes.deleteOne({ id: identityId } as any);
        await this.relations.deleteMany({
          $or: [{ fromIdentityId: identityId }, { toIdentityId: identityId }],
        } as any);
      }

      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

