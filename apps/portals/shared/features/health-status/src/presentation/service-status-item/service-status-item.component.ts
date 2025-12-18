import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';

export interface ServiceStatus {
  name: string;
  uptime: number;
  status: 'operational' | 'degraded' | 'outage';
  hasInfo?: boolean;
}

@Component({
  selector: 'health-service-status-item',
  templateUrl: './service-status-item.component.html',
  styleUrl: './service-status-item.component.scss',
  standalone: true,
  imports: [CommonModule, TuiIcon]
})
export class ServiceStatusItemComponent {
  @Input() service!: ServiceStatus;

  getStatusDays(): Array<{ status: 'operational' | 'degraded' | 'outage' }> {
    // Generate 45 days of status data (all operational for now)
    return Array.from({ length: 45 }, () => ({ status: this.service.status }));
  }
}


