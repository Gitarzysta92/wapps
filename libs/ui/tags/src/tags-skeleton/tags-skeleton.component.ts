import { Component, input } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'ui-tags-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  templateUrl: './tags-skeleton.component.html',
  styleUrl: './tags-skeleton.component.scss'
})
export class TagsSkeletonComponent {
  count = input<number>(3);
}


