import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@standard";
import { ISocialsProvider } from "../application";
import { ReferenceDto } from "@domains/catalog/references";


@Injectable()
export class SocialApiService implements ISocialsProvider {

  public getSocials(): Observable<Result<ReferenceDto[], Error>> {
    return of({
      ok: true,
      value: [
        { id: 0, name: "Facebook", type: "" },
        { id: 1, name: "X", type: "" },
        { id: 2, name: "Reddit", type: "" },
        { id: 3, name: "Discord", type: "" },
        { id: 4, name: "LinkedIn", type: "" },
        { id: 5, name: "Medium", type: "" }
      ],
    })
  }
  
}