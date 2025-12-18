import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';

export interface Notice {
  id: string;
  title: string;
  message: string;
  date: Date;
  type: 'info' | 'warning' | 'error';
}

@Component({
  selector: 'health-notices-section',
  templateUrl: './notices-section.component.html',
  styleUrl: './notices-section.component.scss',
  standalone: true,
  imports: [CommonModule, TuiIcon]
})
export class NoticesSectionComponent {
  @Input() notices: Notice[] = [];
  @Input() showEmptyState = true;
}


