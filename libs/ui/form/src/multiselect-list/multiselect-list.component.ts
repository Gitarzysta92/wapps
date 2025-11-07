import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiCheckbox } from '@taiga-ui/kit';
import { TuiTextfield, TuiTextfieldComponent } from '@taiga-ui/core';
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
  imports: [CommonModule, FormsModule, TuiCheckbox, TuiTextfield, TuiTextfieldComponent, TuiTextfieldControllerModule],
})
export class MultiselectListComponent<O extends SearchableOption, S extends SearchableOption & { isSelected: boolean }> {
  @Input() items: O[] = [];
  @Input() selectedOptions: S[] = [];
  @Input() placeholder: string = '';
  @Input() groupLabel: string = '';
  
  @Output() change: EventEmitter<O[]> = new EventEmitter();

  public searchQuery: string = '';

  public get filteredItems(): O[] {
    if (!this.searchQuery) {
      return this.items;
    }
    return this.items.filter(item => 
      item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  public isSelected(item: O): boolean {
    return this.selectedOptions.some(selected => selected.value === item.value);
  }

  public toggleItem(item: O, checked: boolean): void {
    const currentlySelected = [...this.selectedOptions];
    const index = currentlySelected.findIndex(selected => selected.value === item.value);
    
    if (!checked && index >= 0) {
      currentlySelected.splice(index, 1);
    } else if (checked && index < 0) {
      currentlySelected.push(item as unknown as S);
    }
    
    this.change.emit(currentlySelected as unknown as O[]);
  }
}

