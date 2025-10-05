import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-feed-page',
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedPageComponent {
  constructor() {}
}
