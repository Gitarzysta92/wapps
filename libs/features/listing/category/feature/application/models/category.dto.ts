export type CategoryDto = {
  id: number;
  slug: string;
  name: string;
  childs: CategoryDto[]
}