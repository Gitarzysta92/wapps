import { inject, Injectable, Injector } from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { NavigationStart, Router } from '@angular/router';
import { filter, firstValueFrom, Subject, take, takeUntil } from 'rxjs';
import { LOCAL_APPLICATION_DATA } from '@portals/shared/features/application-overview';
import { publicCommentId } from '@domains/discussion';
import { catalogSlug } from '@domains/catalog/record';

export interface QuickDiscussionData {
  appSlug: string;
  discussionSlug: string;
}

@Injectable({ providedIn: 'root' })
export class QuickDiscussionService {
  private readonly dialogs = inject(TuiDialogService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly demo = inject(LOCAL_APPLICATION_DATA);
  private active = false;

  async open(data: QuickDiscussionData): Promise<void> {
    if (this.active) return;
    const selected = this.demo
      ? { ...data }
      : {
          appSlug: catalogSlug(data.appSlug),
          discussionSlug: publicCommentId(data.discussionSlug),
        };
    this.active = true;
    let cancelled = false;
    const stopped = new Subject<void>();
    const navigation = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        take(1)
      )
      .subscribe(() => {
        cancelled = true;
        stopped.next();
      });
    try {
      const component = this.demo
        ? (await import('./quick-discussion-dialog.component'))
            .QuickDiscussionDialogComponent
        : (await import('./quick-discussion-api-dialog.component'))
            .QuickDiscussionApiDialogComponent;
      if (cancelled) return;
      await firstValueFrom(
        this.dialogs
          .open<void>(
            new PolymorpheusComponent<unknown>(component, this.injector),
            {
              label: 'Discussion',
              size: 'l',
              appearance: 'quick-discussion',
              data: selected,
            }
          )
          .pipe(takeUntil(stopped)),
        { defaultValue: undefined }
      );
    } finally {
      navigation.unsubscribe();
      stopped.complete();
      this.active = false;
    }
  }
}
