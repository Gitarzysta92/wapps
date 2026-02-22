import { ok, Result } from '@sdk/kernel/standard';
import { IdentityCreationDto } from "./models/identity-creation.dto";
import { IIdentityFactory } from "@sdk/features/identity/libs/kernel";
import { Identity } from '../core/identity';
import { IIdentityIdGenerator } from '@sdk/features/identity/libs/kernel';

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