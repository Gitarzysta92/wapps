import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiChip } from '@taiga-ui/kit';
import { RouterLink } from '@angular/router';

export interface Tag {
  slug: string;
  name: string;
  link?: string;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'ui-tags',
  standalone: true,
  imports: [CommonModule, TuiChip, RouterLink],
  templateUrl: './tags.component.html',
  styleUrl: './tags.component.scss',
})
export class TagsComponent {
  tags = input.required<Tag[]>();
  size = input<'xs' | 's'>('xs');
  appearance = input<string>('secondary');
}
