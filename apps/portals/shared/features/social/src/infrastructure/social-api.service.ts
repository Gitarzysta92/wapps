import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@standard";
import { ISocialsProvider } from "../application";
import { SocialDto } from "@domains/catalog/social";


@Injectable()
export class SocialApiService implements ISocialsProvider {

  public getSocials(): Observable<Result<SocialDto[], Error>> {
    return of({
      ok: true,
      value: [
        { id: 0, name: "Facebook" },
        { id: 1, name: "X" },
        { id: 2, name: "Reddit" },
        { id: 3, name: "Discord" },
        { id: 4, name: "LinkedIn" },
        { id: 5, name: "Medium" }
      ],
    })
  }
  
}