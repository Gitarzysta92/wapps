import { Observable } from "rxjs";
import { Result } from "@standard";
import { IdentityDto } from "../models/identity.dto";

export interface IIdentityProvider {
  getIdentity(): Observable<Result<IdentityDto, Error>>
}