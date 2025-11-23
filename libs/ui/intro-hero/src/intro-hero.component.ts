import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgForOf } from '@angular/common';

@Component({
  selector: 'ui-intro-hero',
  templateUrl: './intro-hero.component.html',
  styleUrl: './intro-hero.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgForOf]
})
export class IntroHeroComponent {
  @Input() title: string = 'Discover. Explore. Learn.';
  @Input() subtitle: string = 'Improve your productivity with the best apps on the market.';
  @Input() words: string[] = ['Explore.', 'Discover.', 'Learn.'];
}

