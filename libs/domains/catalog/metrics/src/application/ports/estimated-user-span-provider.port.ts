import { Observable } from "rxjs";
import { AppEstimatedUserSpanDto } from "../models/app-estimated-user-span.dto";
import { Result } from "@foundation/standard";

export interface IEstimatedUserSpanProvider {
  getEstimatedUserSpans(): Observable<Result<AppEstimatedUserSpanDto[], Error>>;
}