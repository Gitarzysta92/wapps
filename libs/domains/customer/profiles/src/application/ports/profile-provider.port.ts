import { Observable } from "rxjs";
import { Result } from "@standard";
import { CustomerProfileDto } from "../models/profile.dto";

export interface IProfileProvider {
  getProfile(id: string): Observable<Result<CustomerProfileDto>>
}

