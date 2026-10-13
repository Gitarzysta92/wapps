export type SearchResultVM = {
  query: { [key: string]: string };
  itemsNumber: number;
  groups: SearchResultGroupVM[];
  link: string;
};

export type SearchResultGroupVM = {
  id: number | string;
  name: string;
  link: string;
  icon: string;
  type: string;
  entries: SearchResultEntryVM[];
};

export type SearchResultEntryVM = {
  id: number | string;
  revision?: number;
  groupId: number | string;
  type: string;
  name: string;
  description: string;
  coverImageUrl: { url: string; alt: string };
  link: string;
  // Application specific
  rating?: number;
  // Article specific
  authorName?: string;
  authorAvatarUrl?: string;
  // Common
  tags?: Array<{ id?: number | string; slug?: string; name: string }>;
};
