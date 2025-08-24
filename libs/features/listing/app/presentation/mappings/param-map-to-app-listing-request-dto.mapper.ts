import { Injectable } from "@angular/core";
import { AppListingQueryDto } from "../../application/models/app-listing-query.dto";

@Injectable()
export class ParamMapToAppListingRequestDtoMapper {
  map(query: { [key: string]: Set<string> }): AppListingQueryDto {
    return {
      index: 'page' in query ? parseInt(query['page'].values().next().value ?? '1') : 1,
      batchSize: 'batchSize' in query ? parseInt(query['batchSize'].values().next().value ?? '10') : 10,
      query: Object.fromEntries(
        Object.entries(query)
          .filter(([k]) => k !== 'page')
          .map(([k, v]) => [k, Array.from(v.values())]))
    };
  }

}