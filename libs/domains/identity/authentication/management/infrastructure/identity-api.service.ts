import { Injectable } from "@angular/core";
import { IIdentityProvider } from "../application/ports";
import { Observable } from "rxjs";
import { Result } from "../../../../utils/utility-types";
import { IdentityDto } from "../application/models";

@Injectable()
export class IdentityApiService implements IIdentityProvider {
  getIdentity(): Observable<Result<IdentityDto, Error>> {
    throw new Error("Method not implemented.");
  }

}