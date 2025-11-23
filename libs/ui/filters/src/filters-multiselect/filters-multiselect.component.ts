import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton } from '@taiga-ui/core';

export type FiltersMultiselectVM = {
  selectedFilters: { id: string, name: string, isSelected: boolean }[];
}

@Component({
  selector: 'filters-multiselect',
  standalone: true,
  imports: [
    FormsModule,
    TuiAppearance,
    TuiButton
  ],
  templateUrl: './filters-multiselect.component.html',
  styleUrl: './filters-multiselect.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltersMultiselectComponent {

  @Input() activeFilters: { id: string, name: string, isSelected: boolean }[] = [];
  @Input() availableFilters: { id: string, name: string, isSelected: boolean }[] = [];
  @Output() activated = new EventEmitter<string>();
  @Output() deactivated = new EventEmitter<string>();
  
  public activate(f: { id: string, name: string, isSelected: boolean }): void {
    this.activated.emit(f.id);
  }
  public deactivate(f: { id: string, name: string, isSelected: boolean }): void {
    this.deactivated.emit(f.id);
  }
}


