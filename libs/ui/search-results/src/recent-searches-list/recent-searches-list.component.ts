import {ChangeDetectionStrategy, Component, input, contentChild, TemplateRef} from '@angular/core';
import {FormsModule} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiAppearance, TuiIcon, TuiLink } from '@taiga-ui/core';
import { CommonModule } from '@angular/common';

export type RecentSearchItem = {
  name: string;
  link: string;
  query: { [key: string]: string };
  icon?: string;
};

@Component({
  selector: "ul[recent-searches-list]",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TuiLink,
    TuiIcon,
    TuiAppearance
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
  public readonly customContent = contentChild<TemplateRef<any>>('customContent');
}
