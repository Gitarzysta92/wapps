import { AfterContentChecked, AfterContentInit, ChangeDetectionStrategy, Component, ContentChildren, EventEmitter, Input, OnDestroy,  Output, QueryList } from '@angular/core';
import { FilterVm } from '../models/filter.vm';
import { FilterDirective } from '../filter.directive';
import { map } from 'rxjs';
import { IFilterGroup } from './filter-group.interface';

@Component({
  selector: 'filter-group',
  templateUrl: './filter-group.component.html',
  styleUrl: './filter-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class FilterGroupComponent implements AfterContentInit, OnDestroy, IFilterGroup, AfterContentChecked {

  @Input() filters: FilterVm[] | null = null;

  @ContentChildren(FilterDirective, {
    descendants: true,
    emitDistinctChangesOnly: true,
  }) private readonly _filterDirectives: QueryList<FilterDirective> = new QueryList();

  @Output() change = new EventEmitter<FilterVm[]>();

  private _s = this._filterDirectives.changes
    .pipe(map(() => this._filterDirectives))
    .subscribe(d => {
      console.log(d)
      d.forEach(d => d.filterGroup = this)
    })

  ngAfterContentInit(): void {
    this._filterDirectives.forEach(d => d.filterGroup = this);
  }

  ngAfterContentChecked(): void {
    this._filterDirectives.forEach(d => d.filterGroup = this);
  }

  ngOnDestroy(): void {
    this._s.unsubscribe();
  }

  public emitChanges(filter: FilterVm): void {
    this.change.next((this.filters ?? []).map(f => f.key === filter.key ? filter : f));
  }

}
