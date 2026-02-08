import * as admin from 'firebase-admin';
import { err, ok, Result } from '@foundation/standard';
import { IUserAdminPort, UserUpdateDto } from '@domains/identity/management';

class FirebaseAdminUserAdminError extends Error {
  override name = 'FirebaseAdminUserAdminError';
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

export class FirebaseAdminUserAdminPort implements IUserAdminPort {
  async updateUser(uid: string, patch: UserUpdateDto): Promise<Result<boolean, Error>> {
    try {
      await admin.auth().updateUser(uid, {
        email: patch.email,
        password: patch.password,
        disabled: patch.disabled,
        providersToUnlink: patch.providersToUnlink,
      });
      return ok(true);
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to update user';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminUserAdminError(message, code));
    }
  }

  async revokeRefreshTokens(uid: string): Promise<Result<boolean, Error>> {
    try {
      await admin.auth().revokeRefreshTokens(uid);
      return ok(true);
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to revoke refresh tokens';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminUserAdminError(message, code));
    }
  }

  async deleteUser(uid: string): Promise<Result<boolean, Error>> {
    try {
      await admin.auth().deleteUser(uid);
      return ok(true);
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to delete user';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminUserAdminError(message, code));
    }
  }

  async generatePasswordResetLink(email: string): Promise<Result<string, Error>> {
    try {
      const link = await admin.auth().generatePasswordResetLink(email);
      return ok(link);
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to generate password reset link';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminUserAdminError(message, code));
    }
  }

  async generateEmailVerificationLink(email: string): Promise<Result<string, Error>> {
    try {
      const link = await admin.auth().generateEmailVerificationLink(email);
      return ok(link);
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to generate email verification link';
      const code = e?.code ? String(e.code) : undefined;
      return err(new FirebaseAdminUserAdminError(message, code));
    }
  }
}

