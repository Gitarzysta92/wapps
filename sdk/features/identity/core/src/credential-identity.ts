import {
  CanonicalIdentityState,
  CanonicalIdentityInputError,
} from './canonical-identity';

/** Exact, opaque names owned by an independently trusted authentication issuer. */
export interface CredentialSubject {
  issuer: string;
  subject: string;
}

export function credentialSubject(value: {
  issuer: unknown;
  subject: unknown;
}): CredentialSubject {
  if (
    !value ||
    typeof value.issuer !== 'string' ||
    typeof value.subject !== 'string' ||
    !/^[\x21-\x7e]{1,128}$/.test(value.issuer) ||
    !/^[\x21-\x7e]{1,128}$/.test(value.subject)
  )
    throw new CanonicalIdentityInputError('Invalid credential subject');
  return { issuer: value.issuer, subject: value.subject };
}

export interface CredentialIdentityBindings {
  findCredential(
    subject: CredentialSubject
  ): Promise<CanonicalIdentityState | null>;
  /** Called only after authentication verifies a registration and its durable retry receipt. */
  enrollCredential(
    subject: CredentialSubject,
    eligible: boolean
  ): Promise<CanonicalIdentityState>;
  credentialSubjects(identityId: string): Promise<CredentialSubject[]>;
}
