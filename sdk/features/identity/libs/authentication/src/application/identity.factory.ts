import { ok, Result } from '@sdk/kernel/standard';
import { Identity } from '@sdk/features/identity/core';
import { IdentityCreationDto } from './models/identity-creation.dto';
import { IIdentityFactory } from './ports/identity-factory.port';
import { IIdentityIdGenerator } from './ports/identity-id-generator.port';

export class IdentityFactory implements IIdentityFactory {

  constructor(
    private readonly ids: IIdentityIdGenerator,
  ) {}

  async create(identityCreationDto: IdentityCreationDto): Promise<Result<Identity, Error>> {
    return ok(new Identity({
      id: this.ids.generate(),
      identityId: this.ids.generate(),
      claim: identityCreationDto.claim,
      kind: identityCreationDto.identityType,
      isActive: false,
      isSuspended: false,
      isDeleted: false,
      providerType: identityCreationDto.provider,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: 0,
    }));
  }
}