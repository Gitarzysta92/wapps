import { Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { IMultiSearchResultsProvider, MultiSearchResultVM, } from "./multi-search.interface";
import { Result } from "@standard";

@Injectable()
export class MultiSearchService implements IMultiSearchResultsProvider {

  private readonly _mockData: MultiSearchResultVM = {
    itemsNumber: 6,
    groups: [
      {
        id: 1,
        name: "Applications",
        link: "",
        entries: [
          {
            id: 1,
            groupId: 1,
            name: "Photo Snap",
            description: "Professional photo editing app",
            coverImageUrl: "",
            link: ""
          },
          {
            id: 2,
            groupId: 1,
            name: "Quick Task",
            description: "Task management and productivity",
            coverImageUrl: "",
            link: ""
          }
        ]
      },
      {
        id: 2,
        name: "Services",
        link: "",
        entries: [
          {
            id: 3,
            groupId: 2,
            name: "Cloud Storage",
            description: "Secure cloud storage solution",
            coverImageUrl: "",
            link: ""
          },
          {
            id: 4,
            groupId: 2,
            name: "API Gateway",
            description: "Manage your APIs efficiently",
            coverImageUrl: "",
            link: ""
          }
        ]
      }
    ]
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  search(_term: { [key: string]: string }): Observable<Result<MultiSearchResultVM>> {
    return of({ ok: true as const, value: this._mockData }).pipe(delay(1000));
  }

  getRecentSearches(): Observable<Result<MultiSearchResultVM>> {
    return of({ ok: true as const, value: this._mockData })
  }

}