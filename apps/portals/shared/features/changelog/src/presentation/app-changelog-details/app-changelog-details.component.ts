import { Component, input } from '@angular/core';
import { NgFor } from '@angular/common';
import { TuiIcon } from '@taiga-ui/core';

export type ChangeItem = {
  description: string;
  type: unknown;
};

@Component({
  selector: 'app-changelog-details',
  standalone: true,
  imports: [NgFor, TuiIcon],
  templateUrl: './app-changelog-details.component.html',
  styleUrl: './app-changelog-details.component.scss'
})
export class AppChangelogDetailsComponent {
  changes = input.required<ChangeItem[]>();
}
