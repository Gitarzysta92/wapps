import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { TuiDialogService } from '@taiga-ui/core';
import { Subject } from 'rxjs';
import { LOCAL_APPLICATION_DATA } from '@portals/shared/features/application-overview';
import { QuickDiscussionService } from './presentation/quick-discussion/quick-discussion.service';
import { QuickDiscussionApiDialogComponent } from './presentation/quick-discussion/quick-discussion-api-dialog.component';
import { QuickDiscussionDialogComponent } from './presentation/quick-discussion/quick-discussion-dialog.component';

const data = {
  appSlug: 'application',
  discussionSlug: '10000000-0000-4000-8000-000000000001',
};

describe('quick discussion dialog lifecycle', () => {
  const settleImport = async () => {
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
  };
  function setup(demo = false) {
    const events = new Subject<NavigationStart>(),
      close = new Subject<void>();
    const open = jest.fn().mockReturnValue(close);
    TestBed.configureTestingModule({
      providers: [
        QuickDiscussionService,
        { provide: Router, useValue: { events } },
        { provide: TuiDialogService, useValue: { open } },
        { provide: LOCAL_APPLICATION_DATA, useValue: demo },
      ],
    });
    return {
      service: TestBed.inject(QuickDiscussionService),
      events,
      close,
      open,
    };
  }
  it('selects the real dialog in API mode, waits for closure, and allows only one active modal', async () => {
    const { service, open, close } = setup();
    const done = jest.fn(),
      input = { ...data };
    const pending = service.open(input).then(done);
    input.appSlug = 'mutated-after-opening';
    await settleImport();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0].component).toBe(
      QuickDiscussionApiDialogComponent
    );
    expect(open.mock.calls[0][1].data).toEqual(data);
    expect(done).not.toHaveBeenCalled();
    await service.open(data);
    expect(open).toHaveBeenCalledTimes(1);
    close.complete();
    await pending;
    expect(done).toHaveBeenCalledTimes(1);
    await service.open(data);
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('uses the browser-local dialog only for explicitly selected demo mode', async () => {
    const { service, open, close } = setup(true);
    const pending = service.open({ ...data, discussionSlug: 'demo-slug' });
    await settleImport();
    expect(open.mock.calls[0][0].component).toBe(
      QuickDiscussionDialogComponent
    );
    close.complete();
    await pending;
  });
  it('rejects sample slugs or invalid application paths in API mode before opening', async () => {
    const { service, open } = setup();
    await expect(
      service.open({ ...data, discussionSlug: 'sample-discussion' })
    ).rejects.toThrow();
    await expect(
      service.open({ ...data, appSlug: '../application' })
    ).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });
  it('cancels navigation during chunk loading and disposes an open dialog on navigation', async () => {
    const { service, open, events } = setup();
    const loading = service.open(data);
    events.next(new NavigationStart(1, '/other'));
    await loading;
    expect(open).not.toHaveBeenCalled();
    const pending = service.open(data);
    await settleImport();
    expect(open).toHaveBeenCalledTimes(1);
    events.next(new NavigationStart(2, '/next'));
    await pending;
  });
  it('propagates dialog errors and permits a retry', async () => {
    const { service, open, close } = setup();
    const failed = service.open(data);
    await settleImport();
    close.error(new Error('Dialog failed'));
    await expect(failed).rejects.toThrow('Dialog failed');
    const fresh = new Subject<void>();
    open.mockReturnValue(fresh);
    const next = service.open(data);
    await settleImport();
    fresh.complete();
    await next;
    expect(open).toHaveBeenCalledTimes(2);
  });
});
