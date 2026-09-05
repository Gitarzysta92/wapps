import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilterOptionVm } from '@ui/filters';
import { TuiButton, TuiDialogContext } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { SearchableOption } from '@ui/form';
import { FilterContentComponent } from '../../components/filter-content/filter-content.component';

export interface FilterSelectionDialogData {
  filterId: string;
  filterName: string;
  options: FilterOptionVm[];
  items: SearchableOption[];
  placeholder: string;
}

export interface FilterSelectionDialogResult {
  filterId: string;
  selected: SearchableOption[];
}

@Component({
  selector: 'filter-selection-dialog',
  standalone: true,
  templateUrl: './filter-selection-dialog.component.html',
  styleUrl: './filter-selection-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiButton,
    FilterContentComponent,
  ],
})
export class FilterSelectionDialogComponent {
  private readonly _context = injectContext<TuiDialogContext<FilterSelectionDialogResult | undefined, FilterSelectionDialogData>>();
  private readonly _data = this._ensureData(this._context.data);

  public readonly options = this._data.options;
  public readonly filterName = this._data.filterName;
  public readonly filterId = this._data.filterId;
  public readonly items = this._data.items;
  public readonly selectedOptions = this._data.items.filter((o): o is SearchableOption & { isSelected: boolean } => 
    'isSelected' in o && o.isSelected === true
  );
  public readonly placeholder = this._data.placeholder;

  public onSelectionChange(selected: SearchableOption[]): void {
    // Store the selection for when Apply is clicked
    this._selectedOptions = selected;
  }

  private _selectedOptions: SearchableOption[] = this.selectedOptions;

  public onCancel(): void {
    this._context.completeWith(undefined);
  }

  public onApply(): void {
    this._context.completeWith({
      filterId: this._data.filterId,
      selected: this._selectedOptions,
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
      items: data.items ?? [],
      placeholder: data.placeholder ?? `Search ${data.filterName.toLowerCase()}...`,
    };
  }
}

