import { Observable } from "rxjs";
import { Result } from "@standard";
import { SocialDto } from "../models/social.dto";

export interface ISocialsProvider {
  getSocials(): Observable<Result<SocialDto[], Error>>;
}