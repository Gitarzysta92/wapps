import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { ReferenceDto } from "@domains/catalog/references";
export const SOCIALS_PROVIDER = new InjectionToken<ISocialsProvider>('SOCIALS_PROVIDER_PORT');

export interface ISocialsProvider {
  getSocials(): Observable<Result<ReferenceDto[], Error>>;
}
