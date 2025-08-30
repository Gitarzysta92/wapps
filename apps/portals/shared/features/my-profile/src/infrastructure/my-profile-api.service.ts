import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Result } from "@standard";
import { Observable, of } from "rxjs";
import { IMyProfileProvider, MyProfileDto, MY_PROFILE_API_BASE_URL_PROVIDER, MY_PROFILE_AVATAR_BASE_URL_PROVIDER } from "@domains/customer/my-profile";

@Injectable()
export class MyProfileApiService implements IMyProfileProvider {

  private readonly _httpClient = inject(HttpClient);
  private readonly _apiBaseUrl = inject(MY_PROFILE_API_BASE_URL_PROVIDER);
  private readonly _avatarBaseUrl = inject(MY_PROFILE_AVATAR_BASE_URL_PROVIDER);
  
  public getMyProfile(): Observable<Result<MyProfileDto>> {
    return of({
      value: {
        id: "string",
        name: "string",
        avatarUrn: "https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png"
      },
    })
  }

}