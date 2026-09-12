import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MultiselectListComponent, SearchableOption, TextSearchInputComponent } from '@ui/form';

type SearchableOptionWithSelection = SearchableOption & { isSelected: boolean };

@Component({
  selector: 'filter-content',
  standalone: true,
  imports: [
    CommonModule,
    MultiselectListComponent,
    TextSearchInputComponent,
  ],
  templateUrl: './filter-content.component.html',
  styleUrl: '../../partials/filters-bar/src/filter-content.component.scss',
})
export class FilterContentComponent {
  @Input() filterId!: string;
  @Input() filterName!: string;
  @Input() items: SearchableOption[] = [];
  @Input() selectedOptions: SearchableOptionWithSelection[] = [];
  @Input() placeholder: string = '';
  @Input() showSelectionSummary = false;

  @Output() selectionChange = new EventEmitter<SearchableOption[]>();

  public onSelectionChange(selected: SearchableOption[]): void {
    this.selectionChange.emit(selected);
  }
}
