import type { Observable } from 'rxjs';
import type { Result } from '@foundation/standard';
import type { CredentialsDto } from '../models/credentials.dto';
import type { AuthenticationProvider } from '../models/authentication-provider';
import type { AuthenticationMethodDto } from '../models/authentication-method.dto';

export interface IAuthenticationHandler {
  authenticate(credentials: CredentialsDto): Observable<Result<string, Error>>;
  authenticateWithProvider(provider: AuthenticationProvider): Observable<Result<string, Error>>;
  getAvailableMethods(): Observable<AuthenticationMethodDto[]>;

  /**
   * Returns a new access token.
   *
   * - BFF-based implementations typically ignore `currentToken` and use a stored refresh token.
   * - Mock implementations may accept `currentToken` and return a new one.
   */
  signOut?(): Observable<Result<void, Error>>;

  refreshToken(currentToken?: string): Observable<Result<string, Error>>;
}
