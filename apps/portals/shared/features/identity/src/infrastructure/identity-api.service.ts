import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@foundation/standard";
import { IIdentityProvider, IdentityDto } from "@domains/identity/authentication";

@Injectable()
export class IdentityApiService implements IIdentityProvider {
  getIdentity(): Observable<Result<IdentityDto, Error>> {
    return of({
      ok: true,
      value: {
        id: "1",
        name: "John Doe"
      }
    })
  }

}