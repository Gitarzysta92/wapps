import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiLink } from '@taiga-ui/core';

export type RecentSearchItem = {
  name: string;
  link: string;
  query: { [key: string]: string };
};

@Component({
  selector: "ul[recent-searches-list]",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TuiLink
  ],
  templateUrl: 'recent-searches-list.component.html',
  styleUrl: 'recent-searches-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'recent-searches-list'
  }
})
export class RecentSearchesList {
  public readonly searches = input.required<RecentSearchItem[]>({ alias: 'recent-searches-list' });
}
