import * as admin from 'firebase-admin';
import { err, ok, Result } from '@foundation/standard';
import {
  CreateUserDto,
  IUserProvisioner,
  ProvisionedUserDto,
} from '@domains/identity/authentication';

class FirebaseAdminError extends Error {
  override name = 'FirebaseAdminError';
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

export class FirebaseAdminUserProvisioner implements IUserProvisioner {
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
    try {
      const user = await admin.auth().createUser({
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
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

