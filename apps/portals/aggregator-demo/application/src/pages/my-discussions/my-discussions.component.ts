import { Component } from '@angular/core';
import { TuiTitle } from '@taiga-ui/core';
import { TuiCardLarge, TuiHeader } from '@taiga-ui/layout';
import { DiscussionComponent } from '@portals/shared/features/discussion';

@Component({
  selector: 'my-discussions-page',
  templateUrl: 'my-discussions.component.html',
  styleUrl: 'my-discussions.component.scss',
  standalone: true,
  imports: [
    TuiTitle,
    TuiCardLarge,
    TuiHeader,
    DiscussionComponent,
  ]
})
export class MyDiscussionsPageComponent {
  // TODO: Add state management when discussion state provider is available
  protected readonly discussions = [];
  protected readonly isLoading = false;
  protected readonly isError = false;
}


