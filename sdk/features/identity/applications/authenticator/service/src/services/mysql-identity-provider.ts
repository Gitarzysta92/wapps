import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IdentityCreationDto, IIdentityProvider } from '@sdk/features/identity/libs/authentication';
import { Identity } from '@sdk/features/identity/libs/kernel';
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
    private readonly identityRepo: Repository<IdentityEntity>
  ) {}

  createIdentity(
    identityCreationDto: IdentityCreationDto,
    extras?: { activate?: boolean }
  ): Promise<Result<Identity, Error>> {
    void identityCreationDto;
    void extras;
    throw new Error('Method not implemented.');
  }

  async obtainIdentity(claim: string): Promise<Result<Identity, Error>> {
    try {
      const entity = await this.identityRepo.findOne({ where: { claim } });
      if (!entity) {
        return err(new Error(`Identity not found for claim: ${claim}`));
      }
      return ok(toDomain(entity));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}
