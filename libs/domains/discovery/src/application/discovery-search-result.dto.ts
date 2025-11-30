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
  coverImageUrl: { url: string; alt: string };
}


export type DiscoverySearchResultArticleItemDto = {
  title: string;
  excerpt: string;
  slug: string;
  coverImageUrl: { url: string; alt: string };
  commentsNumber: number;
  authorName: string;
  authorAvatarUrl: string;
  tags: TagDto[];
} & DiscoverySearchResultEntryDto;

export type DiscoverySearchResultApplicationItemDto = {
  name: string;
  slug: string;
  coverImageUrl: { url: string; alt: string };
  rating: number;
  commentsNumber: number;
  category: CategoryDto;
  tags: TagDto[];
  // THOUGHT: potential imlicit coupling
  // drive and observe
  topReview: {
    rate: number;
    content: string;
    authorName: string;
    authorAvatarUrl: string;
  } | null,
} & DiscoverySearchResultEntryDto;

export type DiscoverySearchResultSuiteItemDto = {
  name: string;
  slug: string;
  coverImageUrl: { url: string; alt: string };
  numberOfApps: number;
  commentsNumber: number;
  authorName: string;
  authorAvatarUrl: string;
  tags: TagDto[];
  applications: Array<{
    name: string;
    slug: string;
    avatarUrl: string;
  }>;
  // DD: not optional (?) because
  // it is more verbose when you actually
  // have to specify explicitly is additionall
  // content exits. More bytes, but also more informative.
  topComment: {
    content: string;
    authorName: string;
    authorAvatarUrl: string;
    date: string;
    upvotes: number;
  } | null;
} & DiscoverySearchResultEntryDto;