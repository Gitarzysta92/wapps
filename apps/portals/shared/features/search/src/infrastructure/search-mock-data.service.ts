import { Injectable } from "@angular/core";
import { SearchResultDto } from "@domains/catalog/search";

@Injectable()
export class SearchMockDataService {
  private readonly _appListingSearchRecords: SearchResultDto = {
    records: [
      {
        id: 1,
        name: "Photo Snap",
        description: "Professional photo editing app",
        rating: 4.5,
        tagIds: [],
        platformIds: [1, 2],
        deviceIds: [1, 2],
      },
      {
        id: 2,
        name: "Quick Task",
        description: "Task management and productivity",
        rating: 4.2,
        tagIds: [],
        platformIds: [1, 2, 3],
        deviceIds: [1, 2, 3],
      }
    ]
  };

  getAppListingSearchRecords(): SearchResultDto {
    return this._appListingSearchRecords;
  }
}
