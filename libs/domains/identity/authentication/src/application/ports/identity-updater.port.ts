import { Observable } from "rxjs";
import { Result } from "@standard";
import { IdentityDto } from "../models/identity.dto";

export interface IIdentityUpdater {
  updateIdentity(i: IdentityDto): Observable<Result<boolean, Error>>
}