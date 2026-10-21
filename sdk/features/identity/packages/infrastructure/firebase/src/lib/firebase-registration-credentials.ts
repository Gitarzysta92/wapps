import { createHash, randomUUID } from 'node:crypto';
import * as admin from 'firebase-admin';
import type { DataSource, QueryRunner } from 'typeorm';
import { err, ok } from '@sdk/kernel/standard';
import {
  CredentialRegistrationRejected,
  IdentityAuthenticationUnavailable,
  type RegistrationCredentials,
} from '@sdk/features/identity/libs/authentication';
import { FirebaseRestSessionGateway } from './firebase-rest-session-gateway';
import { firebaseErrorCode } from './firebase-errors';

/** Reserve the provider subject before creation so an interrupted signup is recoverable. */
export class FirebaseRegistrationCredentials
  implements RegistrationCredentials
{
  constructor(
    private readonly source: DataSource,
    private readonly sessions: FirebaseRestSessionGateway,
    private readonly issuer: string
  ) {}

  signInWithPassword(email: string, password: string) {
    return this.sessions.signInWithPassword(email, password);
  }

  refresh(token: string) {
    return this.sessions.refresh(token);
  }

  async registerOrAuthenticate(email: string, password: string, key?: string) {
    if (!key || !/^[\x21-\x7e]{1,128}$/.test(key))
      return err(
        new CredentialRegistrationRejected('Invalid enrollment request')
      );
    const hash = (value: string) => createHash('sha256').update(value).digest();
    const emailHash = hash(email.toLowerCase());
    const requestHash = hash(key);
    let runner: QueryRunner | undefined;
    try {
      await this.source.query(
        `INSERT INTO firebase_credential_enrollments
          (issuer, email_hash, request_hash, subject)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email_hash = email_hash`,
        [this.issuer, emailHash, requestHash, randomUUID()]
      );
      runner = this.source.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      const rows: {
        subject: Buffer;
        request_hash: Buffer;
        created: number;
      }[] = await runner.query(
        `SELECT subject, request_hash, created FROM firebase_credential_enrollments
         WHERE issuer = ? AND email_hash = ? FOR UPDATE`,
        [this.issuer, emailHash]
      );
      const receipt = rows[0];
      if (
        rows.length !== 1 ||
        !Buffer.isBuffer(receipt?.subject) ||
        !Buffer.isBuffer(receipt.request_hash) ||
        ![0, 1].includes(receipt.created)
      )
        throw new Error('Invalid enrollment receipt');
      const subject = receipt.subject.toString('utf8');
      const ownsReceipt = receipt.request_hash.equals(requestHash);
      if (ownsReceipt && receipt.created === 0) {
        try {
          await admin.auth().createUser({ uid: subject, email, password });
        } catch (error) {
          const code = firebaseErrorCode(error) ?? '';
          if (
            [
              'auth/invalid-email',
              'auth/invalid-password',
              'auth/password-does-not-meet-requirements',
            ].includes(code)
          ) {
            // A definitive rejection can release the reservation while concurrent attempts wait.
            await runner.query(
              'DELETE FROM firebase_credential_enrollments WHERE issuer = ? AND email_hash = ?',
              [this.issuer, emailHash]
            );
            await runner.commitTransaction();
            return err(
              new CredentialRegistrationRejected(
                'Registration details were rejected'
              )
            );
          }
          if (
            !['auth/email-already-exists', 'auth/uid-already-exists'].includes(
              code
            )
          )
            throw error;
        }
      }
      // A collision is never proof of ownership: verify the password and exact reserved UID.
      const session = await this.sessions.signInWithPassword(email, password);
      if (!session.ok) return session;
      const eligible = ownsReceipt && session.value.uid === subject;
      if (eligible && receipt.created === 0)
        await runner.query(
          `UPDATE firebase_credential_enrollments SET created = 1
           WHERE issuer = ? AND email_hash = ? AND subject = ? AND request_hash = ?`,
          [this.issuer, emailHash, subject, requestHash]
        );
      await runner.commitTransaction();
      return ok({ ...session.value, enrollmentEligible: eligible });
    } catch {
      return err(
        new IdentityAuthenticationUnavailable(
          'Registration service unavailable'
        )
      );
    } finally {
      if (runner) {
        try {
          if (runner.isTransactionActive) await runner.rollbackTransaction();
        } finally {
          await runner.release();
        }
      }
    }
  }
}
