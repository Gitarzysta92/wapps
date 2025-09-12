import { Observable } from "rxjs";
import { EstimatedUserSpanDto } from "../models/estimated-user-span.dto";
import { Result } from "@standard";


export interface IEstimatedUserSpanProvider {
  getEstimatedUserSpans(): Observable<Result<EstimatedUserSpanDto[], Error>>;
}

