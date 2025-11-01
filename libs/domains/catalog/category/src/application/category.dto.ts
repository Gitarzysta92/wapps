export type CategoryTreeDto = {
  id: number;
  slug: string;
  name: string;
  childs: CategoryTreeDto[];
}

export type CategoryDto = {
  id: number; 
  name: string;
  slug: string;
  parentId: number | null;
  rootId: number | null;
  depth: number;
}