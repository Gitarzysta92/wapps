import { firebaseErrorMessage } from './firebase-errors';
import { err, ok, Result } from '@sdk/kernel/standard';
import * as admin from 'firebase-admin';

export class FirebaseTokenGenerator {
  async generateToken(uid: string): Promise<Result<string, Error>> {
    try {
      const token = await admin.auth().createCustomToken(uid);
      return ok(token);
    } catch (e) {
      const message = firebaseErrorMessage(e, 'Failed to create custom token');
      return err(new Error(message));
    }
  }
}
