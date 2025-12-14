import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiChip } from '@taiga-ui/kit';

export interface AppCategory {
  name: string;
  slug: string;
  link?: string;
}

@Component({
  selector: 'app-category-chip',
  standalone: true,
  imports: [TuiChip, RouterLink],
  templateUrl: './app-category-chip.component.html',
  styleUrl: './app-category-chip.component.scss'
})
export class AppCategoryChipComponent {
  category = input.required<AppCategory>();
  size = input<'xs' | 's' | 'm'>('s');
  appearance = input<string>('primary');
}
