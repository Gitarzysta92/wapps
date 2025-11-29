import { Component, Input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'titled-separator',
  templateUrl: './titled-separator.component.html',
  styleUrl: './titled-separator.component.scss',
  standalone: true,
  imports: [TuiIcon],
})
export class TitledSeparatorComponent {
  @Input() text: string | undefined;
  @Input() icon: string | undefined;
}

