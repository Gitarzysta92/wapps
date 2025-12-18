import { Component, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';

export type ChangelogInfoData = {
  version: string;
  releaseDate: Date;
  description: string;
};

@Component({
  selector: 'app-changelog-info',
  standalone: true,
  imports: [TuiIcon],
  templateUrl: './app-changelog-info.component.html',
  styleUrl: './app-changelog-info.component.scss'
})
export class AppChangelogInfoComponent {
  data = input.required<ChangelogInfoData>();
}


