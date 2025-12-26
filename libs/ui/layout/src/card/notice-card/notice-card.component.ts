import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-notice-card',
  standalone: true,
  templateUrl: './notice-card.component.html',
  styleUrl: './notice-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'notice-card'
  }
})
export class NoticeCardComponent {}

