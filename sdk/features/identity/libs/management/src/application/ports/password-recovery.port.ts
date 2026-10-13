export interface PasswordRecovery {
  /** Requests provider delivery. Never returns a recovery link or account-existence detail. */
  send(email: string): Promise<void>;
}

export class PasswordRecoveryUnavailable extends Error {}
