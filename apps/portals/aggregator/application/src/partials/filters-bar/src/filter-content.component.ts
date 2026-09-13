import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiRadio } from '@taiga-ui/kit';
import { CommonModule } from '@angular/common';
import { MultiselectListComponent, SearchableOption, TextSearchInputComponent } from '@ui/form';

type SearchableOptionWithSelection = SearchableOption & { isSelected: boolean };

@Component({
  selector: 'filter-content',
  standalone: true,
  imports: [
    CommonModule,
    TuiRadio,
    FormsModule,
    MultiselectListComponent,
    TextSearchInputComponent,
  ],
  templateUrl: './filter-content.component.html',
  styleUrl: './filter-content.component.scss',
})
export class FilterContentComponent {
  @Input() filterId!: string;
  @Input() filterName!: string;
  @Input() items: SearchableOption[] = [];
  @Input() selectedOptions: SearchableOptionWithSelection[] = [];
  @Input() placeholder: string = '';
  @Input() singleSelection = false;
  @Input() showSelectionSummary = false;

  @Output() selectionChange = new EventEmitter<SearchableOption[]>();

  public onSelectionChange(selected: SearchableOption[]): void {
    this.selectionChange.emit(selected);
  }
}
