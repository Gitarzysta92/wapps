import { v7 as uuidv7 } from 'uuid';
import { Collection, Document } from 'mongodb';
import { err, ok, Result } from '@foundation/standard';
import {
  IDENTITY_KIND,
  identitySubjectId,
  IIdentityNode,
  IIdentityNodeRelation,
  IIdentitySubject,
  IIdentitySubjectRepository,
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
  private readonly subjectsRepo: IIdentitySubjectRepository;

  constructor(
    mongo: PlatformMongoClient,
    subjectsRepo: IIdentitySubjectRepository,
    opts?: { nodesCollection?: string; relationsCollection?: string }
  ) {
    this.nodes = mongo.collection<IdentityNodeDoc>(opts?.nodesCollection ?? 'identity_nodes');
    this.relations = mongo.collection<IdentityRelationDoc>(opts?.relationsCollection ?? 'identity_relations');
    this.subjectsRepo = subjectsRepo;
  }

  async ensureForFirebaseUid(uid: string): Promise<Result<EnsureIdentityResult, Error>> {
    const provider = 'firebase';
    const subjectId = identitySubjectId(provider, uid);

    try {
      const existing = await this.subjectsRepo.getByProviderExternalId(provider, uid);
      if (!existing.ok) return err(existing.error);
      if (existing.value?.identityId) {
        return ok({ identityId: existing.value.identityId, subjectId, created: false });
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

      const subject: IIdentitySubject = {
        id: subjectId,
        provider,
        externalId: uid,
        identityId,
        createdAt: now,
        updatedAt: now,
        deletedAt: 0,
      };

      await this.nodes.updateOne({ id: identityId } as any, { $setOnInsert: identityNode }, { upsert: true });
      const upserted = await this.subjectsRepo.upsert(subject);
      if (!upserted.ok) {
        // best-effort cleanup to avoid orphan identity nodes
        try {
          await this.nodes.deleteOne({ id: identityId } as any);
        } catch {
          // ignore
        }
        return err(upserted.error);
      }

      return ok({ identityId, subjectId, created: true });
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

