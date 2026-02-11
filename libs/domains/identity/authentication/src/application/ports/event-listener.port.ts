export type IdentityCreatedEvent = {
  provider: string;
  externalId: string;
  identityId: string;
  subjectId: string;
  correlationId?: string;
};

/**
 * Optional hook for cross-cutting identity management events.
 * Implementations are expected to be best-effort (non-blocking).
 */
export interface IIdentityManagementEventListener {
  onIdentityCreated?(event: IdentityCreatedEvent): Promise<void> | void;
}

