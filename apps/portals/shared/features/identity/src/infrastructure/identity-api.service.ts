import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@foundation/standard";
import { IClientIdentityProvider, ClientIdentityDto } from "@domains/identity/authentication";

@Injectable()
export class IdentityApiService implements IClientIdentityProvider {
  getIdentity(): Observable<Result<ClientIdentityDto, Error>> {
    return of({
      ok: true,
      value: {
        id: "1",
        name: "John Doe"
      }
    })
  }

}