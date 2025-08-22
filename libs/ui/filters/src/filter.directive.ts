import { Directive, Input } from '@angular/core';
import { FilterOptionVm, FilterVm } from './models/filter.vm';
import { IFilterGroup } from './filter-group/filter-group.interface';

@Directive({
  selector: '[filter]',
  exportAs: 'filter',
})
export class FilterDirective {
  
  @Input() filter!: FilterVm;
  @Input() filterGroup!: IFilterGroup;
  
  public updateMany(options: FilterOptionVm[]): void {
    const x = {
      ...this.filter,
      options: this.filter.options.map(o => ({
        ...o,
        isSelected: false
      }))
    }

    for (let option of options) {
      const prev = x.options.find(o => o.value === option.value);
      if (prev) {
        prev.isSelected = true
      } else {
        x.options.push({
          ...option,
          isSelected: true
        });
      }
    }
    this.filterGroup.emitChanges(x);
  }

  public update(v: FilterOptionVm, isSelected: boolean): void {
    const x = {
      ...this.filter,
      options: this.filter.options.map(o => ({ ...o }))
    }
    const prev = x.options.find(o => o.value === v.value);
    if (prev) {
      prev.isSelected = isSelected;
    } else {
      x.options.push({
        ...v,
        isSelected: isSelected
      })
    }
    this.filterGroup.emitChanges(x)
  }

}
