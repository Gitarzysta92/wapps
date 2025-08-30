import { Injectable } from "@angular/core";
import { IdentityDto, IIdentityProvider } from "@features/identity";
import { Observable } from "rxjs";
import { Result } from "@standard";
//import { IdentityDto } from "../application/models";

@Injectable()
export class IdentityApiService implements IIdentityProvider {
  getIdentity(): Observable<Result<IdentityDto, Error>> {
    throw new Error("Method not implemented.");
  }

}