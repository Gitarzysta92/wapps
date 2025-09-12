import { Observable } from "rxjs";
import { Result } from "@standard";
import { PlatformDto } from "../models/platform.dto";

export interface IPlatformsProvider {
  getPlatforms(): Observable<Result<PlatformDto[], Error>>;
}

