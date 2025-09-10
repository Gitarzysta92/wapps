import { Result } from "@standard";
import { Observable } from "rxjs";
import { CredentialsDto } from "../models/credentials.dto";

export interface IAuthenticationHandler {
  authenticate(c: CredentialsDto): Observable<Result<string, Error>>;
}