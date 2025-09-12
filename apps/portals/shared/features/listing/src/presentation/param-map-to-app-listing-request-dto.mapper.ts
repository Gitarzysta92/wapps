import { Injectable } from "@angular/core";
import { AppListingQueryDto } from "../application/models/app-listing-query.dto";



@Injectable()
export class ParamMapToAppListingRequestDtoMapper {
  map(query: { [key: string]: Set<string> }): AppListingQueryDto {
    return {
      page: 'page' in query ? parseInt(query['page'].values().next().value ?? '1') : 1,
      query: Object.fromEntries(Object.entries(query).map(([k, v]) => [k, Array.from(v.values())]))
    };
  }

}