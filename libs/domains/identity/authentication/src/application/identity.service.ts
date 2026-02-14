import { err, isErr, ok, Result } from '@foundation/standard';
import { IdentityCreationDto } from './models/identity-creation.dto';
import { Identity } from '../core/identity';
import { IIdentityEventEmitter, IIdentityRepository } from '@domains/identity/kernel';
import { IIdentityFactory } from '@domains/identity/kernel';


export class IdentityService {

  constructor(
    private readonly eventsEmmiter: IIdentityEventEmitter,
    private readonly repository: IIdentityRepository,
    private readonly factory: IIdentityFactory,
  ) { }
  
  async obtainIdentity(claim: string): Promise<Result<Identity, Error>> {
    const result = await this.repository.getByClaim(claim);
    if (!result.ok) {
      return err(result.error);
    }
    const identity = result.value;

    if (!identity.isValid()) {
      return err(new Error('Invalid identity'));
    }

    if (!identity.canBeObtained()) {
      return err(new Error('Identity cannot be obtained'));
    }

    return ok(identity);
  }

  async createIdentity(
    identityCreationDto: IdentityCreationDto,
    extras: { activate?: boolean } = { activate: false }
  ): Promise<Result<Identity, Error>> {

    const identityCreationResult = await this.factory.create(identityCreationDto);

    if (isErr(identityCreationResult)) {
      return err(identityCreationResult.error);
    }

    const identity = identityCreationResult.value;

    if (extras.activate) {
      identity.activate();
    }

    if (!identity.isValid()) { 
      return err(new Error('Invalid identity'));
    }

    const result = await this.repository.upsert(identity);
    if (!result.ok) {
      return err(result.error);
    }

    await this.eventsEmmiter.publishCreated({
      identityId: identity.identityId,
      provider: identityCreationDto.provider,
      claim: identityCreationDto.claim,
    });

    return ok(identity);
  }

}
