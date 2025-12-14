import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { map } from 'rxjs';
import { ProfileBadgesComponent } from '@portals/shared/features/user-profile';
import { USER_PROFILE_PROVIDER } from '@portals/shared/features/user-profile';
import { ROUTE_PARAMS } from '../../navigation';

@Component({
  selector: 'profile-page',
  templateUrl: 'profile-page.component.html',
  styleUrl: 'profile-page.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    TuiTitle,
    TuiHeader,
    ProfileBadgesComponent
  ]
})
export class ProfilePageComponent {
  private readonly profileProvider = inject(USER_PROFILE_PROVIDER);

  protected readonly state$ = this.profileProvider.getProfile(ROUTE_PARAMS.profileId);
}

export const profilePageComponent = ProfilePageComponent;
