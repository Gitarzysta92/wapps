import { Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'ui-medium-card-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  templateUrl: './medium-card-skeleton.component.html',
  styleUrl: './medium-card-skeleton.component.scss'
})
export class MediumCardSkeletonComponent {}


