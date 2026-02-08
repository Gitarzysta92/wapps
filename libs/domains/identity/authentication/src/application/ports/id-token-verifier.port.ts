import { Result } from '@foundation/standard';

export type VerifiedIdTokenDto = {
  uid: string;
  email?: string;
  authTime?: number;
  claims?: unknown;
};

export interface IIdTokenVerifier {
  verifyIdToken(token: string): Promise<Result<VerifiedIdTokenDto, Error>>;
}

