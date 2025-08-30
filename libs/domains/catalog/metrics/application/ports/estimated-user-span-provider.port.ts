import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { EstimatedUserSpanDto } from "../models/estimated-user-span.dto";
import { Result } from "../../../../../../utils/utility-types";

export const ESTIMATED_USER_SPAN_PROVIDER = new InjectionToken<IEstimatedUserSpanProvider>('ESTIMATED_USER_SPAN_PROVIDER');

export interface IEstimatedUserSpanProvider {
  getEstimatedUserSpans(): Observable<Result<EstimatedUserSpanDto[], Error>>;
}

