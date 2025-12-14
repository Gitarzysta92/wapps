import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { MY_PROFILE_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { map } from 'rxjs';
import { ProfileBadgesComponent } from '@portals/shared/features/user-profile';

@Component({
  selector: 'my-profile-page',
  templateUrl: 'my-profile-page.component.html',
  styleUrl: 'my-profile-page.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    TuiTitle,
    TuiHeader,
    ProfileBadgesComponent
  ]
})
export class MyProfilePageComponent {
  private readonly myProfileStateProvider = inject(MY_PROFILE_STATE_PROVIDER);

  protected readonly profile$ = this.myProfileStateProvider.myProfile$.pipe(
    map(state => state.data)
  );

  protected readonly isLoading$ = this.myProfileStateProvider.myProfile$.pipe(
    map(state => state.isLoading)
  );

  protected readonly isError$ = this.myProfileStateProvider.myProfile$.pipe(
    map(state => state.isError)
  );
}

