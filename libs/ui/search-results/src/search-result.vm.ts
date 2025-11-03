export type SearchResultVM = {
  query: { [key: string]: string };
  itemsNumber: number;
  groups: SearchResultGroupVM[];
  link: string;
}

export type SearchResultGroupVM = {
  id: number;
  name: string;
  link: string;
  icon: string;
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