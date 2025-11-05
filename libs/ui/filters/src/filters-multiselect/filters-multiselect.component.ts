import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiCheckbox } from '@taiga-ui/kit';

export type FiltersMultiselectVM = {
  selectedFilters: { id: string, name: string, isSelected: boolean }[];
}

@Component({
  selector: 'filters-multiselect',
  standalone: true,
  imports: [FormsModule, TuiCheckbox],
  templateUrl: './filters-multiselect.component.html',
  styleUrl: './filters-multiselect.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltersMultiselectComponent {

  @Input() vm: FiltersMultiselectVM | null = null;
  @Output() activate = new EventEmitter<string>();
  @Output() deactivate = new EventEmitter<string>();

  toggle(e: Event, t: { id: string; name: string; isSelected: boolean; }) {
    e.preventDefault();
    e.stopPropagation();
    if (t.isSelected) {
      this.deactivate.emit(t.id);
    } else {
      this.activate.emit(t.id);
    }
  }
}


