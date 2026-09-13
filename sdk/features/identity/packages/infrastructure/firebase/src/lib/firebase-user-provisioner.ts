import * as admin from 'firebase-admin';
import { err, ok, Result } from '@sdk/kernel/standard';
import type { OAuthUserInfoDto } from './oauth-user-info.dto';

export type ProvisionedUserDto = { uid: string };

export type CreateUserDto = OAuthUserInfoDto;

class FirebaseAdminError extends Error {
  override name = 'FirebaseAdminError';
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

export class FirebaseUserProvisioner {
  async getUserByEmail(email: string): Promise<Result<ProvisionedUserDto, Error>> {
    try {
      const user = await admin.auth().getUserByEmail(email);
      return ok({ uid: user.uid });
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to get user';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminError(message, code));
    }
  }

  async createUser(data: CreateUserDto): Promise<Result<ProvisionedUserDto, Error>> {
    if (!data.email || !data.emailVerified) return err(new Error('A verified provider email is required'));
    try {
      const existing = await admin.auth().getUserByEmail(data.email).catch((error) => {
        if (error.code === 'auth/user-not-found') return null;
        throw error;
      });
      if (existing) {
        if (existing.disabled || !existing.emailVerified) return err(new Error('Existing account cannot be linked'));
        return ok({ uid: existing.uid });
      }
      const user = await admin.auth().createUser({
        email: data.email,
        displayName: data.name,
        photoURL: data.picture,
        emailVerified: data.emailVerified,
      });
      return ok({ uid: user.uid });
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to create user';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminError(message, code));
    }
  }

  async createCustomToken(uid: string): Promise<Result<string, Error>> {
    try {
      const token = await admin.auth().createCustomToken(uid);
      return ok(token);
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to create custom token';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminError(message, code));
    }
  }
}

