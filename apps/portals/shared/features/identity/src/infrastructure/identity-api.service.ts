import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { IIdentityProvider, IdentityDto } from "@domains/identity/authentication";

@Injectable()
export class IdentityApiService implements IIdentityProvider {
  getIdentity(): Observable<Result<IdentityDto, Error>> {
    throw new Error("Method not implemented.");
  }

}