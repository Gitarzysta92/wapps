import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { RegistrationDto } from "../models/registration.dto";


export interface IRegistrationHandler {
  register(r: RegistrationDto): Observable<Result<boolean, Error>>
}