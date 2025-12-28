import { Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'ui-medium-title-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  templateUrl: './medium-title-skeleton.component.html',
  styleUrl: './medium-title-skeleton.component.scss'
})
export class MediumTitleSkeletonComponent {}


