import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { SocialDto } from "@domains/catalog/social";

export const SOCIALS_PROVIDER = new InjectionToken<ISocialsProvider>('SOCIALS_PROVIDER_PORT');

export interface ISocialsProvider {
  getSocials(): Observable<Result<SocialDto[], Error>>;
}
