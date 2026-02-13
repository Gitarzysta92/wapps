import { IdentityCreatedEvent } from "./event-listener.port";

export interface IIdentityEventEmitter {
  publishCreated(arg0: { identityId: any; provider: string; claim: string; }): unknown;
  emitIdentityCreated(event: IdentityCreatedEvent): void;
}