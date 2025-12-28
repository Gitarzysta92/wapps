import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-medium-card',
  standalone: true,
  templateUrl: './medium-card.component.html',
  styleUrl: './medium-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'medium-card'
  }
})
export class MediumCardComponent {}

