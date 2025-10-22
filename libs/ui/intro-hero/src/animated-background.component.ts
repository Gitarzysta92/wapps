import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-animated-background',
  templateUrl: './animated-background.component.html',
  styleUrl: './animated-background.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnimatedBackgroundComponent {}

