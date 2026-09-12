import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiLink } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import { EntryDetailsDataService } from '../entry-details-page/entry-details-data.service';

@Component({
  selector: 'my-suites-page',
  templateUrl: './my-suites.component.html',
  styleUrl: './my-suites.component.scss',
  standalone: true,
  imports: [RouterLink, TuiButton, TuiLink, TuiAvatar, TuiBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySuitesPageComponent {
  readonly suites = inject(EntryDetailsDataService).listMySuites();
}
