import { ChangeDetectionStrategy, Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterOptionVm } from '@ui/filters';
import { TuiButton, TuiTextfield, TuiTextfieldComponent } from '@taiga-ui/core';
import { TuiCheckbox, TuiChip } from '@taiga-ui/kit';

@Component({
  selector: 'filter-dropdown-content',
  standalone: true,
  templateUrl: './filter-dropdown-content.component.html',
  styleUrl: './filter-dropdown-content.component.scss',
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
export class FilterDropdownContentComponent {
  @Input() filterId!: string;
  @Input() filterName!: string;
  @Input() set options(value: FilterOptionVm[]) {
    this._options = value;
    this.selected.set(value.filter(o => o.isSelected));
  }
  get options(): FilterOptionVm[] {
    return this._options;
  }

  @Output() selectionChange = new EventEmitter<FilterOptionVm[]>();
  @Output() close = new EventEmitter<void>();

  private _options: FilterOptionVm[] = [];
  public readonly selected = signal<FilterOptionVm[]>([]);
  public readonly placeholder = signal<string>('Search...');
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
      const newSelected = currentSelected.filter(s => s.value !== option.value);
      this.selected.set(newSelected);
      this.selectionChange.emit(newSelected);
    } else {
      const newSelected = [...currentSelected, option];
      this.selected.set(newSelected);
      this.selectionChange.emit(newSelected);
    }
  }

  public onApply(): void {
    this.close.emit();
  }

  public onCancel(): void {
    this.close.emit();
  }
}

