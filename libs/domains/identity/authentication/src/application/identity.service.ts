import { err, isErr, ok, Result } from '@foundation/standard';
import { IdentityCreationDto } from './models/identity-creation.dto';
import { IIdentityEventEmitter } from './ports/identity-event-emitter.port';
import { IIdentityRepository } from './ports/identity-repository.port';
import { IIdentityFactory } from './ports/identity-factory.port';
import { Identity } from '../core/identity';


export class IdentityService {

  constructor(
    private readonly identityEventsEmmiter: IIdentityEventEmitter,
    private readonly identityRepository: IIdentityRepository,
    private readonly identityFactory: IIdentityFactory,
  ) { }
  
  async obtainIdentity(claim: string): Promise<Result<Identity, Error>> {
    const result = await this.identityRepository.getByClaim(claim);
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

    const identityCreationResult = await this.identityFactory.create(identityCreationDto);

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

    const result = await this.identityRepository.upsert(identity);
    if (!result.ok) {
      return err(result.error);
    }

    await this.identityEventsEmmiter.publishCreated({
      identityId: identity.identityId,
      provider: identityCreationDto.provider,
      claim: identityCreationDto.claim,
    });

    return ok(identity);
  }
  
}
