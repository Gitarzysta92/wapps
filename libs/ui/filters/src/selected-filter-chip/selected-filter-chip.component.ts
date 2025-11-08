import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiChip, TuiFade } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';
import type { FilterOptionVm } from '../models/filter.vm';

@Component({
  selector: 'selected-filter-chip',
  standalone: true,
  imports: [CommonModule, TuiChip, TuiFade, TuiIcon],
  templateUrl: './selected-filter-chip.component.html',
  styleUrl: './selected-filter-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectedFilterChipComponent {
  @Input({ required: true }) name!: string;
  public selectedOptions = input<ReadonlyArray<FilterOptionVm>>([]);

  @Output() open = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();

  public readonly selectedNames = computed(() =>
    (this.selectedOptions() || []).filter(o => !!o.isSelected).map(o => o.name)
  );

  public readonly selectedCount = computed(() => this.selectedNames().length);

  public readonly displayText = computed(() => {
    const names = this.selectedNames();
    if (names.length === 0) {
      return 'None';
    }
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.length} selected`;
  });

  onOpenClick(event: MouseEvent): void {
    event.stopPropagation();
    this.open.emit();
  }

  onCloseClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit();
  }
}


