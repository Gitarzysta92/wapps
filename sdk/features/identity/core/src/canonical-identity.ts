/** The Firebase UID is the canonical actor ID; the SQL row ID identifies its credential subject. */
export interface CanonicalIdentityState {
  identityId: string;
  subjectId: string;
  kind: string;
  provider: string;
  isActive: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  revision: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

export function isCanonicalIdentityId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    ![...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  );
}

export interface CanonicalIdentityDeletion extends CanonicalIdentityState {
  cleanup: 'pending' | 'completed' | 'failed';
}

export interface CanonicalIdentityStore {
  find(uid: string): Promise<CanonicalIdentityState | null>;
  ensure(input: {
    uid: string;
    provider: string;
    kind: string;
    activate: boolean;
  }): Promise<{ state: CanonicalIdentityState; created: boolean }>;
  recordAuthentication(uid: string, provider: string): Promise<void>;
  setSuspended(
    uid: string,
    suspended: boolean
  ): Promise<CanonicalIdentityState>;
  requestDeletion(uid: string): Promise<CanonicalIdentityDeletion>;
}

export class CanonicalIdentityConflict extends Error {}
export class CanonicalIdentityUnavailable extends Error {}
export class CanonicalIdentityInputError extends Error {}
export class CanonicalIdentityAccessDenied extends Error {}
