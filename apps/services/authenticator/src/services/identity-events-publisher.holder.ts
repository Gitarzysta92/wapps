import { Injectable } from '@nestjs/common';
import { RabbitMqIdentityEventsPublisher } from '../infrastructure/rabbitmq-identity-events.publisher';

@Injectable()
export class IdentityEventsPublisherHolder {
  private publisher: RabbitMqIdentityEventsPublisher | undefined;

  set(publisher: RabbitMqIdentityEventsPublisher | undefined): void {
    this.publisher = publisher;
  }

  get(): RabbitMqIdentityEventsPublisher | undefined {
    return this.publisher;
  }
}

