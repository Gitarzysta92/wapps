import { err, ok, Result } from "@foundation/standard";
import * as admin from 'firebase-admin';

export class FirebaseTokenGenerator {

  async generateToken(uid: string): Promise<Result<string, Error>> {
    try {
      const token = await admin.auth().createCustomToken(uid);
      return ok(token);
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Failed to create custom token';
      const code = e?.code ? String(e.code) : undefined;
      return err(new Error(message));
    }
  }
}