import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { ApplicationHealthStatusCode } from '@domains/feed';

export type StatusHistoryItem = {
  status: ApplicationHealthStatusCode;
  timestamp: number;
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

  getStatusClass(status: ApplicationHealthStatusCode): string {
    switch (status) {
      case ApplicationHealthStatusCode.Operational:
        return 'operational';
      case ApplicationHealthStatusCode.Degraded:
        return 'degraded';
      case ApplicationHealthStatusCode.Outage:
        return 'outage';
      default:
        return 'operational';
    }
  }

  getStatusLabel(status: ApplicationHealthStatusCode): string {
    switch (status) {
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
