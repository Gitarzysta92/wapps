import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@standard";
import { ISocialsProvider, SocialDto } from "../../../../../../../libs/features/listing/social/application";

@Injectable()
export class SocialApiService implements ISocialsProvider {

  public getSocials(): Observable<Result<SocialDto[], Error>> {
    return of({
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