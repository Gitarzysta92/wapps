import { Observable } from "rxjs";
import { Result } from "@standard";
import { ReferenceDto } from "../models/reference.dto";

export interface IReferencesProvider {
  getReferences(): Observable<Result<ReferenceDto[], Error>>;
}