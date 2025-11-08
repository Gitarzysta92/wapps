import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Output} from '@angular/core';
import {TuiButton, TuiDataList, TuiDropdown} from '@taiga-ui/core';
import { RouteDrivenContainerDirective } from '@ui/routing';

@Component({
  selector: 'sorting-select',
  templateUrl: './sorting-select.component.html',
  styleUrl: './sorting-select.component.scss',
  standalone: true,
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  imports: [
    CommonModule,
    TuiButton,
    TuiDataList,
    TuiDropdown,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingSelectComponent {
  @Output() onUpdate: EventEmitter<{ sort: string }> = new EventEmitter();

  protected readonly sortOptions = [
    'Relevance',
    'Name (A-Z)',
    'Name (Z-A)',
    'Rating (High to Low)',
    'Rating (Low to High)',
    'Newest First',
    'Oldest First',
  ];

  protected value: string | null = null;
  protected dropdownOpen = false;

  protected selectOption(option: string): void {
    this.value = option;
    this.dropdownOpen = false;
    this.onUpdate.emit({ sort: option });
  }
}
