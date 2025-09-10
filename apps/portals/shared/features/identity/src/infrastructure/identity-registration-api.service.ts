import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { IRegistrationHandler, RegistrationDto } from "@domains/identity/authentication";


@Injectable()
export class IdentityRegistrationApiService implements IRegistrationHandler {
  public register(r: RegistrationDto): Observable<Result<boolean, Error>> {
    throw new Error("Method not implemented.");
  }
}