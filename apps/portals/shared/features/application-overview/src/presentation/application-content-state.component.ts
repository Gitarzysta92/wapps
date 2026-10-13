import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ContentStateComponent } from '@ui/layout';
import type { ApplicationContentReader } from '../application/application-content-reader';

@Component({
  selector: 'application-content-state',
  standalone: true,
  imports: [TuiButton, ContentStateComponent],
  templateUrl: './application-content-state.component.html',
  styleUrl: './application-content-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationContentStateComponent {
  readonly reader = input.required<ApplicationContentReader>();
}
