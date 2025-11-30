import { Component, input } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'ui-excerpt-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  templateUrl: './excerpt-skeleton.component.html',
  styleUrl: './excerpt-skeleton.component.scss'
})
export class ExcerptSkeletonComponent {
  lines = input<number>(3);
}


