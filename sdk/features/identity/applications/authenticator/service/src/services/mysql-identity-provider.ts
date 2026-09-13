import { IdentityEventsPublisherHolder } from './identity-events-publisher.holder';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IdentityCreationDto, IIdentityProvider } from '@sdk/features/identity/libs/authentication';
import { Identity } from '@sdk/features/identity/core';
import { Result, err, ok } from '@sdk/kernel/standard';
import { Repository } from 'typeorm';
import { IdentityEntity } from '../entities/identity.entity';

function toDomain(entity: IdentityEntity): Identity {
  return Identity.create({
    id: entity.id,
    identityId: entity.identityId,
    claim: entity.claim,
    kind: entity.kind,
    isActive: entity.isActive,
    isSuspended: entity.isSuspended,
    isDeleted: entity.isDeleted,
    providerType: entity.providerType,
    providerSecret: entity.providerSecret ?? undefined,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
  });
}

@Injectable()
export class MysqlIdentityProvider implements IIdentityProvider {
  constructor(
    @InjectRepository(IdentityEntity)
    private readonly identityRepo: Repository<IdentityEntity>,
    private readonly events: IdentityEventsPublisherHolder
  ) {}

  async createIdentity(
    dto: IdentityCreationDto,
    extras: { activate?: boolean } = { activate: true }
  ): Promise<Result<Identity, Error>> {
    try {
      const now = Date.now();
      const entity = this.identityRepo.create({
        id: randomUUID(), identityId: dto.identityId, claim: dto.claim,
        kind: dto.kind, providerType: dto.provider,
        isActive: extras.activate ?? true, isSuspended: false, isDeleted: false,
        providerSecret: null, createdAt: now, updatedAt: now, deletedAt: 0,
      });
      await this.identityRepo.insert(entity);
      this.events.get()?.publishCreated({ identityId: entity.identityId, subjectId: entity.id });
      return ok(toDomain(entity));
    } catch (e) {
      // Concurrent first sign-ins must converge without overwriting account state.
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
        const existing = await this.obtainIdentity(dto.claim);
        if (existing.ok && existing.value) return ok(existing.value);
      }
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async obtainIdentity(claim: string): Promise<Result<Identity | null, Error>> {
    try {
      const entity = await this.identityRepo.findOne({ where: { claim } });
      if (!entity) {
        return ok(null);
      }
      return ok(toDomain(entity));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
