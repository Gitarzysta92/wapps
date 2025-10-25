import { Observable } from "rxjs";
import { AppContactDto } from "../models/app-contact.dto";
import { Result } from "@standard";

export interface IContactProvider {
  getContacts(): Observable<Result<AppContactDto[], Error>>;
}
