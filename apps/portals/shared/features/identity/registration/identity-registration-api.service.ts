import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "../../../../utils/utility-types";
import { IRegistrationHandler } from "../../../../../../libs/features/identity/registration/application/ports";
import { RegistrationDto } from "../../../../../../libs/features/identity/registration/application/models";

@Injectable()
export class IdentityRegistrationApiService implements IRegistrationHandler {
  public register(r: RegistrationDto): Observable<Result<boolean, Error>> {
    throw new Error("Method not implemented.");
  }
}