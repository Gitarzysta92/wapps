import { EntityType } from "./constants";


export type DiscoveryRecentSearchesDto = {
  searches: Array<{
    query: { [key: string]: string };
  }>;
}


export type DiscoverySearchResultDto = {
  query: { [key: string]: string };
  itemsNumber: number;
  groups: DiscoverySearchResultGroupDto[];
}

export type DiscoverySearchResultGroupDto = {
  type: EntityType
  entries: DiscoverySearchResultEntryDto[];
}

export type DiscoverySearchResultEntryDto = {
  name: string;
  slug: string;
  coverImageUrl: string;
}