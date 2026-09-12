import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiCheckbox, TuiChip } from '@taiga-ui/kit';
import { TuiTextfield } from '@taiga-ui/core';
import { TuiTextfieldControllerModule } from '@taiga-ui/legacy';

export interface SearchableOption {
  name: string;
  value: string;
}

@Component({
  selector: 'multiselect-list',
  templateUrl: './multiselect-list.component.html',
  styleUrl: './multiselect-list.component.scss',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiCheckbox, TuiChip, TuiTextfield, TuiTextfieldControllerModule],
})
export class MultiselectListComponent<O extends SearchableOption, S extends SearchableOption & { isSelected: boolean }> {
  @Input() items: O[] = [];
  @Input() selectedOptions: S[] = [];
  @Input() placeholder: string = '';
  @Input() groupLabel: string = '';
  @Input() showSelectionSummary = false;
  
  @Output() selectionChange: EventEmitter<O[]> = new EventEmitter();

  public searchQuery: string = '';
  @ViewChild('optionsList') private optionsList?: ElementRef<HTMLElement>;

  public get searchPlaceholder(): string {
    return this.placeholder || `Search ${this.groupLabel ? this.groupLabel.toLowerCase() : 'options'}...`;
  }

  public onSearchChange(query: string | null): void {
    this.searchQuery = query ?? '';
    if (this.optionsList) this.optionsList.nativeElement.scrollTop = 0;
  }

  public get filteredItems(): O[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return this.items;
    }
    return this.items.filter(item => 
      item.name.toLowerCase().includes(query)
    );
  }

  public isSelected(item: O): boolean {
    return this.selectedOptions.some(selected => selected.value === item.value);
  }

  public toggleItem(item: SearchableOption, checked: boolean): void {
    const currentlySelected = [...this.selectedOptions];
    const index = currentlySelected.findIndex(selected => selected.value === item.value);
    
    if (!checked && index >= 0) {
      currentlySelected.splice(index, 1);
    } else if (checked && index < 0) {
      currentlySelected.push(item as unknown as S);
    }
    
    this.selectionChange.emit(currentlySelected as unknown as O[]);
  }
}
