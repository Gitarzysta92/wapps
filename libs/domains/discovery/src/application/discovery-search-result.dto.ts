import { CategoryDto, TagDto } from "./auxiliary.dto";
import { DiscoverySearchResultType } from "./constants";


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
  type: DiscoverySearchResultType
  entries: Array<
    DiscoverySearchResultArticleItemDto |
    DiscoverySearchResultApplicationItemDto | 
    DiscoverySearchResultSuiteItemDto
  >;
}

export type DiscoverySearchResultEntryDto = {
  type: DiscoverySearchResultType;
  name: string;
  slug: string;
  coverImageUrl: string;
}


export type DiscoverySearchResultArticleItemDto = {
  title: string;
  slug: string;
  coverImageUrl: string;
  commentsNumber: number;
  authorName: string;
  authorAvatarUrl: string;
  tags: TagDto[];
} & DiscoverySearchResultEntryDto;

export type DiscoverySearchResultApplicationItemDto = {
  name: string;
  slug: string;
  coverImageUrl: string;
  rating: number;
  commentsNumber: number;
  category: CategoryDto;
  tags: TagDto[];
} & DiscoverySearchResultEntryDto;

export type DiscoverySearchResultSuiteItemDto = {
  name: string;
  slug: string;
  coverImageUrl: string;
  numberOfApps: number;
  commentsNumber: number;
  authorName: string;
  authorAvatarUrl: string;
  tags: TagDto[];
} & DiscoverySearchResultEntryDto;