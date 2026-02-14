

export interface IAuthenticationEventEmitter {
  publishAuthenticated(payload: AuthenticationAuthenticatedPayload): Promise<void> | void;
}