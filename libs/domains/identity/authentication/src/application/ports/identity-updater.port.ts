import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { IdentityDto } from "../models/identity.dto";

export interface IIdentityUpdater {
  updateIdentity(i: IdentityDto): Observable<Result<boolean, Error>>
}