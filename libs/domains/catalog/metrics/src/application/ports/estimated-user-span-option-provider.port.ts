import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { EstimatedUserSpanOptionDto } from "../models/estimated-user-span-option.dto";

export interface IEstimatedUserSpanOptionProvider {
  getEstimatedUserSpanOptions(): Observable<Result<EstimatedUserSpanOptionDto[], Error>>;
}



