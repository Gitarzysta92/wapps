import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'health-status-banner',
  templateUrl: './status-banner.component.html',
  styleUrl: './status-banner.component.scss',
  standalone: true,
  imports: [CommonModule, TuiIcon]
})
export class StatusBannerComponent {
  @Input() status: 'operational' | 'degraded' | 'outage' = 'operational';
  @Input() message = 'All Systems Operational';
  @Input() timestamp: Date = new Date();

  getStatusIcon(): string {
    switch (this.status) {
      case 'operational': return '@tui.check-circle';
      case 'degraded': return '@tui.alert-triangle';
      case 'outage': return '@tui.x-circle';
      default: return '@tui.check-circle';
    }
  }
}



