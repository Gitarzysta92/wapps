export type FilterVm = {
  key: string;
  name: string;
  options: FilterOptionVm[];
}

export type FilterOptionVm = {
  name: string;
  value: string;
  isSelected: boolean;
}