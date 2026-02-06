import { IIdentityGraphProvisioner } from '@domains/identity/identification';
import { Result } from '@foundation/standard';
import { RabbitMqIdentityEventsPublisher } from './rabbitmq-identity-events.publisher';

export class EmittingIdentityGraphProvisioner implements IIdentityGraphProvisioner {
  constructor(
    private readonly inner: IIdentityGraphProvisioner,
    private readonly publisher: RabbitMqIdentityEventsPublisher
  ) {}

  async ensureIdentityForFirebaseUid(
    uid: string
  ): Promise<Result<{ identityId: string; subjectId: string; created: boolean }, Error>> {
    const r = await this.inner.ensureIdentityForFirebaseUid(uid);
    if (r.ok && r.value.created) {
      this.publisher.publishCreated({
        identityId: r.value.identityId,
        subjectId: r.value.subjectId,
        correlationId: r.value.identityId,
      });
    }
    return r;
  }

  async deleteIdentityForFirebaseUid(uid: string): Promise<Result<boolean, Error>> {
    return await this.inner.deleteIdentityForFirebaseUid(uid);
  }
}

