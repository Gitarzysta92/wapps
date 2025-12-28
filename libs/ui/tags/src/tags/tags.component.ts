import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiChip } from '@taiga-ui/kit';

export interface Tag {
  slug: string;
  name: string;
  link?: string;
}

@Component({
  selector: 'ui-tags',
  standalone: true,
  imports: [CommonModule, TuiChip],
  templateUrl: './tags.component.html',
  styleUrl: './tags.component.scss'
})
export class TagsComponent {
  tags = input.required<Tag[]>();
  size = input<'xs' | 's'>('xs');
  appearance = input<string>('secondary');
}

