import { Component, computed, effect, inject, input } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { ProfileTotalsService } from '../../application/profile-totals.service';
@Component({
  selector: 'profile-totals',
  standalone: true,
  templateUrl: './profile-totals.component.html',
  styleUrl: './profile-totals.component.scss',
  imports: [TuiButton],
  providers: [ProfileTotalsService],
})
export class ProfileTotalsComponent {
  readonly profileId = input<string | null>(null);
  readonly totals = inject(ProfileTotalsService);
  readonly items = computed(() => {
    const value = this.totals.value();
    return value
      ? [
          { label: 'Discussion threads', value: value.discussions },
          { label: 'Public favorites', value: value.favorites },
          { label: 'Published suites', value: value.suites },
          { label: 'Published articles', value: value.articles },
        ]
      : [];
  });
  constructor() {
    effect(() => this.totals.open(this.profileId()));
  }
}
