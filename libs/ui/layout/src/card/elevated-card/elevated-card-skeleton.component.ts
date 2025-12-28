import { Component } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

@Component({
  selector: 'ui-elevated-card-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  templateUrl: './elevated-card-skeleton.component.html',
  styleUrl: './elevated-card-skeleton.component.scss'
})
export class ElevatedCardSkeletonComponent {}


