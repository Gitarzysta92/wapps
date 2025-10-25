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
  @Input() title: string = 'Discover. Explore. Connect.';
  @Input() subtitle: string = 'Your gateway to amazing applications and content';
  @Input() words: string[] = ['Discover.', 'Explore.', 'Connect.'];
}

