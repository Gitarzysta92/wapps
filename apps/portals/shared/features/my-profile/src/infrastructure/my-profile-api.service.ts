import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Result } from "@standard";
import { Observable, of } from "rxjs";
import { IMyProfileProvider, ProfileDto } from "@domains/customer/profiles";
import { DEFAULT_PROFILE } from "@portals/shared/data";
import { MY_PROFILE_API_BASE_URL_PROVIDER, MY_PROFILE_AVATAR_BASE_URL_PROVIDER } from "../application/infrastructure-providers.port";

@Injectable()
export class MyProfileApiService implements IMyProfileProvider {

  private readonly _httpClient = inject(HttpClient);
  private readonly _apiBaseUrl = inject(MY_PROFILE_API_BASE_URL_PROVIDER);
  private readonly _avatarBaseUrl = inject(MY_PROFILE_AVATAR_BASE_URL_PROVIDER);
  
  public getMyProfile(): Observable<Result<ProfileDto>> {
    return of({
      ok: true,
      value: DEFAULT_PROFILE,
    })
  }

}