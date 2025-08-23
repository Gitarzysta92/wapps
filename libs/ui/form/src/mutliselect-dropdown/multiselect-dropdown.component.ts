import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, EventEmitter, input, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiDataList } from '@taiga-ui/core';
import { TuiDataListWrapper } from '@taiga-ui/kit';
import { TuiMultiSelectModule, TuiTextfieldControllerModule } from '@taiga-ui/legacy';
import { BehaviorSubject, combineLatest, debounceTime, map } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';


@Component({
  selector: 'multiselect-dropdown',
  templateUrl: './multiselect-dropdown.component.html',
  styleUrl: './multiselect-dropdown.component.scss',
  imports: [

    CommonModule,
    FormsModule,
    TuiDataList,
    TuiDataListWrapper,
    TuiMultiSelectModule,
    TuiTextfieldControllerModule,
    AsyncPipe,
  ]
})
export class MultiselectDropdownComponent<T extends { name: string, value: string }> {

  @Input() selectedOptions: T[] = [];
  items = input<T[]>([])
  @Output() change: EventEmitter<T[]> = new EventEmitter();
  
  public readonly searchPhrase$: BehaviorSubject<string> = new BehaviorSubject('');

  public readonly searchResults$ = combineLatest([toObservable(this.items), this.searchPhrase$.pipe(debounceTime(200))])
    .pipe(
      map(([os, sp]) => sp && sp?.length > 0 ? os.filter(o => o.name.includes(sp)) : os),
  )
  
  public searchChange(e: any): void {
    this.searchPhrase$.next(e);
  }

  public stringifyItem = (item: any): string => item.name;

  public stringifyItem2 = (item: any): string => {
    console.log(item)
    return item.name;
  }

  public identityMatcher = (a: { value: string }, b: { value: string }): boolean => a.value === b.value;
}
