export type SearchResultVM = {
  itemsNumber: number;
  groups: SearchResultGroupVM[];
}

export type SearchResultGroupVM = {
  id: number;
  name: string;
  entries: SearchResultEntryVM[];
}

export type SearchResultEntryVM = {
  id: number;
  groupId: number;
  name: string;
  description: string;
  coverImageUrl: string;
  link: string;
}