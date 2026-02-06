import { Pipe, PipeTransform } from '@angular/core';
import type { FilterOptionVm } from './models/filter.vm';

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

@Pipe({
  name: 'toFilterOptionsList',
  standalone: true,
  pure: true,
})
export class ToFilterOptionsList implements PipeTransform {
  transform<T extends { id: number; name: string }>(
    items: T[] | null,
    options: FilterOptionVm[]
  ): FilterOptionVm[] {
    return (items ?? []).map((item) => {
      const value = generateSlug(item.name);
      return {
        name: item.name,
        value,
        isSelected: options.find((o) => o.value === value)?.isSelected ?? false,
      };
    });
  }
}

