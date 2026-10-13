import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { FeedContainerComponent } from './feed-container.component';
import { FEED_PROVIDER_TOKEN, IFeedPage } from './ports/feed-provider.port';
import { NewsFeedService } from './services/news-feed.service';

describe('feed container states', () => {
  it('does not display an empty feed during loading or failure and recovers to authoritative empty', () => {
    const pending = new Subject<Result<IFeedPage, Error>>();
    const provider = {
      getFeedPage: jest
        .fn()
        .mockReturnValueOnce(pending)
        .mockReturnValueOnce(
          of({ ok: true, value: { items: [], hasMore: false } })
        ),
    };
    TestBed.configureTestingModule({
      imports: [FeedContainerComponent],
      providers: [
        provideRouter([]),
        NewsFeedService,
        { provide: FEED_PROVIDER_TOKEN, useValue: provider },
      ],
    });
    const fixture = TestBed.createComponent(FeedContainerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading activity');
    expect(fixture.nativeElement.textContent).not.toContain('No news items');
    expect(fixture.nativeElement.textContent).not.toContain('No activity yet');
    pending.next({ ok: false, error: new Error('Unavailable') });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Could not load activity'
    );
    expect(fixture.nativeElement.textContent).not.toContain('No news items');
    expect(fixture.nativeElement.textContent).not.toContain('No activity yet');
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No activity yet');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Could not load activity'
    );
  });
});
