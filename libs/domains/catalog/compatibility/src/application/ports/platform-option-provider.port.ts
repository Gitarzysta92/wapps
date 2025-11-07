import { Observable } from "rxjs";
import { Result } from "@standard";
import { PlatformOptionDto } from "../models/platform-option.dto";

export interface IPlatformOptionProvider {
  getPlatformOptions(): Observable<Result<PlatformOptionDto[], Error>>;
}


