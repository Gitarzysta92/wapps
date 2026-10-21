import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { ApplicationHealthStatusCode } from '@domains/feed';
import type { CurrentHealth } from '@domains/reliability';

export type StatusHistoryItem = {
  status: ApplicationHealthStatusCode | CurrentHealth;
  timestamp: number;
  label?: string;
};

@Component({
  selector: 'status-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor, NgIf, DatePipe],
  templateUrl: './status-history.component.html',
  styleUrls: ['./status-history.component.scss']
})
export class StatusHistoryComponent {
  statusesHistory = input.required<StatusHistoryItem[]>();

  getStatusClass(status: StatusHistoryItem['status']): string {
    switch (status) {
      case 'operational':
      case ApplicationHealthStatusCode.Operational:
        return 'operational';
      case 'degraded':
      case ApplicationHealthStatusCode.Degraded:
        return 'degraded';
      case 'outage':
      case ApplicationHealthStatusCode.Outage:
        return 'outage';
      default:
        return 'unknown';
    }
  }

  getStatusLabel(status: StatusHistoryItem['status']): string {
    switch (status) {
      case 'operational': return 'Responding';
      case 'degraded': return 'Slow response';
      case 'outage': return 'Check failed';
      case 'stale': return 'Stale';
      case ApplicationHealthStatusCode.Operational:
        return 'Operational';
      case ApplicationHealthStatusCode.Degraded:
        return 'Degraded';
      case ApplicationHealthStatusCode.Outage:
        return 'Outage';
      default:
        return 'Unknown';
    }
  }
}
