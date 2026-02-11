import { err, ok, Result } from '@foundation/standard';
import {
  IDENTITY_KIND,
  identitySubjectId,
  IIdentityNode,
  IIdentitySubject,
  IIdentitySubjectRepository,
} from '@foundation/identity-system';
import { IIdentityIdGenerator } from './ports/identity-id-generator.port';
import { IIdentityNodeRepository } from './ports/identity-node-repository.port';

export type EnsureIdentityResult = {
  identityId: string;
  subjectId: string;
  created: boolean;
};

export class IdentityService {
  constructor(
    private readonly nodes: IIdentityNodeRepository,
    private readonly subjects: IIdentitySubjectRepository,
    private readonly ids: IIdentityIdGenerator
  ) {}

  async addIdentityNode(
    provider: string,
    externalId: string
  ): Promise<Result<EnsureIdentityResult, Error>> {
    const subjectId = identitySubjectId(provider, externalId);

    try {
      const existing = await this.subjects.getByProviderExternalId(provider, externalId);
      if (!existing.ok) return err(existing.error);
      if (existing.value?.identityId) {
        return ok({ identityId: existing.value.identityId, subjectId, created: false });
      }

      const now = Date.now();
      const identityId = this.ids.generate();

      const identityNode: IIdentityNode = {
        id: identityId,
        kind: IDENTITY_KIND,
        isActive: true,
        isSuspended: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: 0,
      };

      const subject: IIdentitySubject = {
        id: subjectId,
        providerType: provider,
        externalId,
        identityId,
        createdAt: now,
        updatedAt: now,
        deletedAt: 0,
      };

      const createdNode = await this.nodes.createIfNotExists(identityNode);
      if (!createdNode.ok) return err(createdNode.error);

      const upserted = await this.subjects.upsert(subject);
      if (!upserted.ok) {
        // best-effort cleanup to avoid orphan identity nodes
        await this.nodes.deleteById(identityId);
        return err(upserted.error);
      }

      return ok({ identityId, subjectId, created: true });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

