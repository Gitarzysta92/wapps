import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { TuiDataList } from '@taiga-ui/core';
import { TuiDataListWrapper } from '@taiga-ui/kit';
import { TuiMultiSelectModule, TuiTextfieldControllerModule } from '@taiga-ui/legacy';
import { CategoryListContainerDirective } from '@portals/shared/features/categories';
import { FilterOptionVm } from '@ui/filters';
import { combineLatest, debounceTime, map, Subject } from 'rxjs';
import { CategoryDtoToFilterOptionVmMapper } from '@portals/shared/features/categories';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'category-multiselect',
  templateUrl: './category-multiselect.component.html',
  styleUrl: './category-multiselect.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AsyncPipe,
    TuiDataList,
    TuiDataListWrapper,
    TuiMultiSelectModule,
    TuiTextfieldControllerModule,
  ],
  hostDirectives: [
    CategoryListContainerDirective
  ]
})
export class CategoryMultiselectComponent<T> {

  @Input() selectedOptions: FilterOptionVm[] = [];
  @Output() change: EventEmitter<[]> = new EventEmitter();

  private readonly _mapper = inject(CategoryDtoToFilterOptionVmMapper);

  public readonly categories$ = inject(CategoryListContainerDirective, { self: true }).categories$

  public readonly options$ = this.categories$.pipe(map(cs => cs.map(c => this._mapper.map(c))))
  public readonly searchPhrase$: Subject<string | null> = new Subject();


  public readonly searchResults$ = combineLatest([this.options$, this.searchPhrase$.pipe(debounceTime(200))])
    .pipe(
      map(([os, sp]) => (sp && os.filter(o => o.name.includes(sp))) ?? null)
    )

  public searchChange(e: any): void {
    this.searchPhrase$.next(e);
  }

  public stringifyItem = (item: any): string => item.name;

  public identityMatcher = (a: FilterOptionVm, b: FilterOptionVm): boolean => a.value === b.value;

}
