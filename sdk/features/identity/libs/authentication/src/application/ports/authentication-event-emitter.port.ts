export type AuthenticationAuthenticatedPayload = { identityId: string; provider: string };

export interface IAuthenticationEventEmitter {
  publishAuthenticated(payload: AuthenticationAuthenticatedPayload): Promise<void> | void;
}