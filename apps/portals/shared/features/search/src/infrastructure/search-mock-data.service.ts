import { Injectable } from "@angular/core";
import { IMultiSearchResult } from "../application/models/search-results.interface";

@Injectable()
export class SearchMockDataService {
  private readonly _appListingSearchRecords: IMultiSearchResult = {
    records: [
      {
        id: 1,
        name: "Photo Snap",
        description: "Professional photo editing app",
        rating: 4.5,
        tagIds: [],
        platformIds: [1, 2],
        deviceIds: [1, 2],
        associatedSuites: []
      },
      {
        id: 2,
        name: "Quick Task",
        description: "Task management and productivity",
        rating: 4.2,
        tagIds: [],
        platformIds: [1, 2, 3],
        deviceIds: [1, 2, 3],
        associatedSuites: []
      }
    ]
  };

  getAppListingSearchRecords(): IMultiSearchResult {
    return this._appListingSearchRecords;
  }
}
