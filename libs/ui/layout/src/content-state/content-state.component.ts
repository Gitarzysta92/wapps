import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';

/** Shared presentation; the caller supplies recovery actions for its own context. */
@Component({
  selector: 'ui-content-state',
  standalone: true,
  imports: [TuiIcon],
  templateUrl: './content-state.component.html',
  styleUrl: './content-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentStateComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input('@tui.search');
  readonly page = input(false);
  readonly error = input(false);
}
