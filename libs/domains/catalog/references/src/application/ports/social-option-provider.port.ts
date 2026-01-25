import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { SocialOptionDto } from "../models/social-option.dto";

export interface ISocialOptionProvider {
  getSocialOptions(): Observable<Result<SocialOptionDto[], Error>>;
}



