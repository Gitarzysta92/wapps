import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterOptionVm } from '@ui/filters';
import { TuiButton, TuiDialogContext, TuiTextfield, TuiTextfieldComponent } from '@taiga-ui/core';
import { TuiCheckbox, TuiChip } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';

export interface FilterSelectionDialogData {
  filterId: string;
  filterName: string;
  options: FilterOptionVm[];
}

export interface FilterSelectionDialogResult {
  filterId: string;
  selected: FilterOptionVm[];
}

@Component({
  selector: 'filter-selection-dialog',
  standalone: true,
  templateUrl: './filter-selection-dialog.component.html',
  styleUrl: './filter-selection-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TuiButton,
    TuiChip,
    TuiTextfield,
    TuiTextfieldComponent,
    TuiCheckbox,
  ],
})
export class FilterSelectionDialogComponent {
  private readonly _context = injectContext<TuiDialogContext<FilterSelectionDialogResult | undefined, FilterSelectionDialogData>>();
  private readonly _data = this._ensureData(this._context.data);

  public readonly options = this._data.options;
  public readonly filterName = this._data.filterName;
  public readonly selected = signal<FilterOptionVm[]>(this._data.options.filter(o => o.isSelected));
  public readonly placeholder = `Search ${this._data.filterName.toLowerCase()}...`;
  public searchPhrase = signal<string>('');

  public readonly hasSelection = computed(() => this.selected().length > 0);

  public readonly filteredOptions = computed(() => {
    const phrase = this.searchPhrase().trim().toLowerCase();
    if (!phrase) {
      return this.options;
    }
    return this.options.filter(opt => opt.name.toLowerCase().includes(phrase));
  });

  public isSelected(option: FilterOptionVm): boolean {
    return this.selected().some(s => s.value === option.value);
  }

  public toggleOption(option: FilterOptionVm): void {
    const currentSelected = this.selected();
    const isCurrentlySelected = currentSelected.some(s => s.value === option.value);
    
    if (isCurrentlySelected) {
      this.selected.set(currentSelected.filter(s => s.value !== option.value));
    } else {
      this.selected.set([...currentSelected, option]);
    }
  }

  public onCancel(): void {
    this._context.completeWith(undefined);
  }

  public onApply(): void {
    this._context.completeWith({
      filterId: this._data.filterId,
      selected: this.selected(),
    });
  }

  private _ensureData(data: FilterSelectionDialogData | undefined): FilterSelectionDialogData {
    if (!data) {
      throw new Error('FilterSelectionDialogComponent requires dialog data.');
    }
    return {
      filterId: data.filterId,
      filterName: data.filterName,
      options: data.options ?? [],
    };
  }
}

