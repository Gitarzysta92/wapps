import { Component, EventEmitter, input, Input, Output } from '@angular/core';
import { TuiDataList } from '@taiga-ui/core';
import { TuiDataListWrapper } from '@taiga-ui/kit';
import { TuiMultiSelectModule, TuiTextfieldControllerModule } from '@taiga-ui/legacy';
import { combineLatest, debounceTime, map, Subject } from 'rxjs';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable } from '@angular/core/rxjs-interop';

export interface SearchableOption {
  name: string;
  value: string;
}

@Component({
  selector: 'searchable-multiselect',
  templateUrl: './searchable-multiselect.component.html',
  styleUrl: './searchable-multiselect.component.scss',
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
})
export class SearchableMultiselectComponent<O extends SearchableOption, S extends SearchableOption & { isSelected: boolean }> {
  @Input() selectedOptions: S[] = [];
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  @Input() placeholder: string = '';
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  @Input() groupLabel: string = '';
  
  options = input.required<O[]>();
  
  @Output() change: EventEmitter<O[]> = new EventEmitter();

  public readonly searchPhrase$: Subject<string | null> = new Subject();

  public readonly allOptions$ = toObservable(this.options);

  public readonly searchResults$ = combineLatest([
    this.allOptions$,
    this.searchPhrase$.pipe(debounceTime(200))
  ]).pipe(
    map(([os, sp]) => {
      if (!sp || sp.length === 0) {
        return null;
      }
      return os.filter(o => o.name.toLowerCase().includes(sp.toLowerCase()));
    })
  );

  public searchChange(e: any): void {
    this.searchPhrase$.next(e);
  }

  public stringifyItem = (item: O): string => item.name;

  public identityMatcher = (a: O, b: O): boolean => a.value === b.value;
}

