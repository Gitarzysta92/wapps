export interface IdentityCreatedPayload {
  identityId: string;
  provider: string;
  claim: string;
}

export interface IIdentityEventEmitter {
  publishCreated(payload: IdentityCreatedPayload): Promise<void> | void;
}
