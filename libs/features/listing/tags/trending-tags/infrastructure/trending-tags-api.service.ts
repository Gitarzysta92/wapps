import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "@standard";
import { TrendingTagDto } from "../application/models";
import { ITrendingTagsProvider } from "../application/ports";

@Injectable()
export class TrendingTagsApiService implements ITrendingTagsProvider {
  public getTrendingTags(): Observable<Result<TrendingTagDto[], Error>> {
    return of({
      value:  [  {
        "id": 0,
        "name": "cryptocurrency",
        "slug": "cryptocurrency"
      },
      {
        "id": 1,
        "name": "blockchain",
        "slug": "blockchain"
      },
      {
        "id": 2,
        "name": "trading",
        "slug": "trading"
      },
      {
        "id": 3,
        "name": "investment",
        "slug": "investment"
      },
      {
        "id": 4,
        "name": "finance",
        "slug": "finance"
      },
      {
        "id": 5,
        "name": "project management",
        "slug": "project-management"
      },]
    })
  }
  
}