import { Observable } from "rxjs";
import { Result } from "@standard";
import { MonetizationOptionDto } from "../models/monetization-option.dto";

export interface IMonetizationOptionProvider {
  getMonetizationOptions(): Observable<Result<MonetizationOptionDto[], Error>>;
}



