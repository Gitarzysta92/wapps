import { Component, input } from '@angular/core';
import { TuiChip } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
}

@Component({
  selector: 'context-menu-chip',
  standalone: true,
  imports: [
    TuiIcon
  ],
  hostDirectives: [
    {
      directive: TuiChip,
      inputs: ['size']
    },
  ],
  templateUrl: './context-menu-chip.component.html',
  styleUrl: './context-menu-chip.component.scss'
})
export class ContextMenuChipComponent {
  public readonly contextMenu = input.required<ContextMenuItem[]>();
}




