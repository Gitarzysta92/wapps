import { Component, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'app-changelog-info',
  standalone: true,
  imports: [TuiIcon],
  templateUrl: './app-changelog-info.component.html',
  styleUrl: './app-changelog-info.component.scss'
})
export class AppChangelogInfoComponent {
  version = input.required<string>();
  releaseDate = input.required<Date>();
  description = input.required<string>();
}
