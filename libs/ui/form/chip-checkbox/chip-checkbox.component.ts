import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TuiCheckbox, TuiChip } from '@taiga-ui/kit';

@Component({
  selector: 'chip-checkbox',
  templateUrl: './chip-checkbox.component.html',
  styleUrl: './chip-checkbox.component.scss',
  imports: [
    TuiCheckbox,
    TuiChip
  ]
})
export class ChipCheckboxComponent {
  @Input() checked: boolean = false;
  @Output() change: EventEmitter<boolean> = new EventEmitter()
}
  