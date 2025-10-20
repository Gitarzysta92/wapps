import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'ui-status-banner',
  templateUrl: './status-banner.component.html',
  styleUrl: './status-banner.component.scss',
  standalone: true,
  imports: [CommonModule, TuiIcon]
})
export class StatusBannerComponent {
  @Input() status: 'operational' | 'degraded' | 'outage' = 'operational';
  @Input() message: string = 'All Systems Operational';
  @Input() timestamp: Date = new Date();

  getStatusIcon(): string {
    switch (this.status) {
      case 'operational': return 'tuiIconCheckCircle';
      case 'degraded': return 'tuiIconAlertTriangle';
      case 'outage': return 'tuiIconXCircle';
      default: return 'tuiIconCheckCircle';
    }
  }
}
