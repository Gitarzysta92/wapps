import { inject, Injectable, Injector } from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { QuickDiscussionDialogComponent } from './quick-discussion-dialog.component';

export interface QuickDiscussionData {
  appSlug: string;
  discussionSlug: string;
}

@Injectable({ providedIn: 'root' })
export class QuickDiscussionService {
  private readonly dialogs = inject(TuiDialogService);
  private readonly injector = inject(Injector);

  open(data: QuickDiscussionData): void {
    this.dialogs.open(new PolymorpheusComponent(QuickDiscussionDialogComponent, this.injector), {
      label: 'Discussion', size: 'l', appearance: 'quick-discussion', data,
    }).subscribe();
  }
}
