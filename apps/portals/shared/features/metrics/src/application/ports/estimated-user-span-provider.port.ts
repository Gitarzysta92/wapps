import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { EstimatedUserSpanDto } from "../models/estimated-user-span.dto";
import { InjectionToken } from "@angular/core";

export interface IEstimatedUserSpanProvider {
  getEstimatedUserSpans(): Observable<Result<EstimatedUserSpanDto[], Error>>;
}

export const ESTIMATED_USER_SPAN_PROVIDER = new InjectionToken<IEstimatedUserSpanProvider>('ESTIMATED_USER_SPAN_PROVIDER');
