import { Pipe, PipeTransform } from '@angular/core';
import { FilterOptionVm } from './models/filter.vm';
import { generateSlug } from '../../../features/listing/filter/presentation/helpers/slug-generator';

@Pipe({
  name: 'toFilterOptionsList',
  standalone: true,
  pure: true
})
export class ToFilterOptionsList implements PipeTransform {

  transform<T extends { id: number; name: string }>(
    items: T[] | null,
    options: FilterOptionVm[]
  ): FilterOptionVm[] {
    return (items ?? []).map(item => {
      const value = generateSlug(item.name)
      return {
        name: item.name,
        value: value,
        isSelected: options.find(o => o.value === value)?.isSelected ?? false
      }
    })
  }
}
