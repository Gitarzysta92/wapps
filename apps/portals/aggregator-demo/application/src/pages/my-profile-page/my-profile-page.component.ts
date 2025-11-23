import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TuiTitle } from '@taiga-ui/core';
import { TuiCardLarge, TuiHeader } from '@taiga-ui/layout';
import { TuiAvatar } from '@taiga-ui/kit';
import { MY_PROFILE_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { map } from 'rxjs';

@Component({
  selector: 'my-profile-page',
  templateUrl: 'my-profile-page.component.html',
  styleUrl: 'my-profile-page.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    TuiTitle,
    TuiCardLarge,
    TuiHeader,
    TuiAvatar,
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

