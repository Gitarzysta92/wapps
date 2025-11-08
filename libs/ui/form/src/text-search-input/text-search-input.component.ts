import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core';
import { TuiTextfieldControllerModule } from '@taiga-ui/legacy';
import { FilterOptionVm } from '@ui/filters';
import { debounceTime, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'text-search-input',
  templateUrl: './text-search-input.component.html',
  styleUrl: './text-search-input.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiTextfield,
    TuiTextfieldControllerModule,
  ],
})
export class TextSearchInputComponent implements OnInit, OnDestroy, OnChanges {
  @Input() selectedOptions: FilterOptionVm[] = [];
  @Input() placeholder: string = 'Search...';
  @Output() textChange: EventEmitter<FilterOptionVm[]> = new EventEmitter();

  public searchValue: string = '';
  private readonly _searchSubject = new Subject<string>();
  private readonly _destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Initialize with current value from selectedOptions
    this._updateSearchValue();

    // Debounce search input
    this._searchSubject.pipe(
      debounceTime(300),
      takeUntil(this._destroy$)
    ).subscribe(value => {
      const options: FilterOptionVm[] = value 
        ? [{ name: value, value: value, isSelected: true }]
        : [];
      this.textChange.emit(options);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedOptions'] && !changes['selectedOptions'].firstChange) {
      this._updateSearchValue();
    }
  }

  private _updateSearchValue(): void {
    if (this.selectedOptions.length > 0 && this.selectedOptions[0]?.value) {
      this.searchValue = this.selectedOptions[0].value;
    } else {
      this.searchValue = '';
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._searchSubject.complete();
  }

  public onInputChange(value: string): void {
    this.searchValue = value;
    this._searchSubject.next(value);
  }
}

