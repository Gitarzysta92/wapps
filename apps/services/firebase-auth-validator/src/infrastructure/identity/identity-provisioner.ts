import { v7 as uuidv7 } from 'uuid';
import { Collection, Document } from 'mongodb';
import { err, ok, Result } from '@foundation/standard';
import {
  IDENTITY_KIND,
  SUBJECT_KIND_FIREBASE,
  SUBJECT_TO_IDENTITY_RELATION,
  IIdentityNode,
  IIdentityNodeRelation,
} from '@foundation/identity-system';
import { PlatformMongoClient } from '@infrastructure/mongo';

export type EnsureIdentityResult = {
  identityId: string;
  subjectId: string;
  created: boolean;
};

type IdentityNodeDoc = Document & IIdentityNode;
type IdentityRelationDoc = Document & IIdentityNodeRelation;

export class IdentityProvisioner {
  private readonly nodes: Collection<IdentityNodeDoc>;
  private readonly relations: Collection<IdentityRelationDoc>;

  constructor(
    mongo: PlatformMongoClient,
    opts?: { nodesCollection?: string; relationsCollection?: string }
  ) {
    this.nodes = mongo.collection<IdentityNodeDoc>(opts?.nodesCollection ?? 'identity_nodes');
    this.relations = mongo.collection<IdentityRelationDoc>(opts?.relationsCollection ?? 'identity_relations');
  }

  async ensureForFirebaseUid(uid: string): Promise<Result<EnsureIdentityResult, Error>> {
    const subjectId = `firebase:${uid}`;

    try {
      const existingRel = await this.relations.findOne({
        fromIdentityId: subjectId,
        relationType: SUBJECT_TO_IDENTITY_RELATION,
      } as any);

      if (existingRel?.toIdentityId) {
        return ok({ identityId: existingRel.toIdentityId, subjectId, created: false });
      }

      const now = Date.now();
      const identityId = uuidv7();

      const identityNode: IIdentityNode = {
        id: identityId,
        kind: IDENTITY_KIND,
        createdAt: now,
        updatedAt: now,
        deletedAt: 0,
      };

      const subjectNode: IIdentityNode = {
        id: subjectId,
        kind: SUBJECT_KIND_FIREBASE,
        createdAt: now,
        updatedAt: now,
        deletedAt: 0,
      };

      const relation: IIdentityNodeRelation = {
        id: uuidv7(),
        fromIdentityId: subjectId,
        toIdentityId: identityId,
        relationType: SUBJECT_TO_IDENTITY_RELATION,
        createdAt: now,
      };

      await this.nodes.updateOne({ id: subjectId } as any, { $setOnInsert: subjectNode }, { upsert: true });
      await this.nodes.updateOne({ id: identityId } as any, { $setOnInsert: identityNode }, { upsert: true });
      await this.relations.insertOne(relation as any);

      return ok({ identityId, subjectId, created: true });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

