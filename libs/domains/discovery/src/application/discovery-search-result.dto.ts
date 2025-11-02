import { EntityType } from "./constants";

export type DiscoverySearchResultDto = {
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