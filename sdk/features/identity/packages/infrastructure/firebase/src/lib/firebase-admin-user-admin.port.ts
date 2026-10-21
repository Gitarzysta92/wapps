import * as admin from 'firebase-admin';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  IUserAdminPort,
  UserUpdateDto,
  CredentialInputError,
  CredentialUnavailable,
} from '@sdk/features/identity/libs/management';

function code(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error
    ? error.code
    : undefined;
}

/** Firebase remains credential authority; application lifecycle is stored separately in SQL. */
export class FirebaseAdminUserAdminPort implements IUserAdminPort {
  constructor(
    private readonly auth: () => admin.auth.Auth = () => admin.auth(),
    private readonly timeoutMs = 10_000
  ) {}

  updateUser(
    uid: string,
    patch: UserUpdateDto
  ): Promise<Result<boolean, Error>> {
    return this.run(async () => {
      await this.auth().updateUser(uid, patch);
      return true;
    });
  }

  revokeRefreshTokens(uid: string): Promise<Result<boolean, Error>> {
    return this.run(async () => {
      await this.auth().revokeRefreshTokens(uid);
      return true;
    });
  }

  deleteUser(uid: string): Promise<Result<boolean, Error>> {
    return this.run(async () => {
      try {
        await this.auth().deleteUser(uid);
      } catch (error) {
        if (code(error) !== 'auth/user-not-found') throw error;
      }
      return true;
    });
  }

  generatePasswordResetLink(
    uid: string,
    email: string
  ): Promise<Result<string, Error>> {
    return this.run(async () => {
      await this.matchEmail(uid, email);
      return this.auth().generatePasswordResetLink(email);
    });
  }

  generateEmailVerificationLink(
    uid: string,
    email: string
  ): Promise<Result<string, Error>> {
    return this.run(async () => {
      await this.matchEmail(uid, email);
      return this.auth().generateEmailVerificationLink(email);
    });
  }

  private async matchEmail(uid: string, email: string): Promise<void> {
    const user = await this.auth().getUser(uid);
    if (!user.email || user.email.toLowerCase() !== email.toLowerCase())
      throw new CredentialInputError(
        'Email does not belong to the authorized target'
      );
  }

  private async run<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new CredentialUnavailable('Credential provider timed out')),
          this.timeoutMs
        );
        timer.unref();
      });
      return ok(await Promise.race([operation(), timeout]));
    } catch (error) {
      if (error instanceof CredentialInputError) return err(error);
      if (
        [
          'auth/invalid-email',
          'auth/invalid-password',
          'auth/email-already-exists',
          'auth/user-not-found',
          'auth/invalid-provider-id',
        ].includes(String(code(error)))
      )
        return err(new CredentialInputError('Invalid credential operation'));
      return err(new CredentialUnavailable('Credential provider unavailable'));
    } finally {
      clearTimeout(timer);
    }
  }
}
