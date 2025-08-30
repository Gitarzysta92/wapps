import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@standard";
import { IPlatformsProvider, PlatformDto } from "@domains/catalog/platform";

@Injectable()
export class PlatformApiService implements IPlatformsProvider {

  public getPlatforms(): Observable<Result<PlatformDto[], Error>> {
    return of({
      value: [
        { id: 0, name: "Web" },
        { id: 1, name: "IOS" },
        { id: 2, name: "Android" },
        { id: 3, name: "Windows" },
        { id: 4, name: "Linux" },
        { id: 5, name: "MacOS" }
      ],
    })
  }
  
}