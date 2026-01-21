import { Result } from "@foundation/standard";
import { Observable } from "rxjs";
import { CredentialsDto } from "../models/credentials.dto";
import { AuthenticationProvider } from "../models/authentication-provider.enum";
import { AuthenticationMethodDto } from "../models/authentication-method.dto";

export interface IAuthenticationHandler {
  authenticate(c: CredentialsDto): Observable<Result<string, Error>>;
  authenticateWithProvider(provider: AuthenticationProvider): Observable<Result<string, Error>>;
  getAvailableMethods(): Observable<AuthenticationMethodDto[]>;
}