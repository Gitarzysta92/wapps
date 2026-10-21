import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ok, type Result } from '@sdk/kernel/standard';
import type { ReviewSummary } from '@sdk/features/review/core';
import { ReviewsService } from '@portals/shared/features/review';
import { ApplicationReviewSummaryComponent } from './application-review-summary.component';

describe('overview review summary', () => {
  const summary: ReviewSummary = { total: 2, average: 4.5, distribution: [0, 0, 0, 1, 1] };
  const sessionVersion = signal(0);
  const summaryFor = jest.fn();
  beforeEach(() => {
    sessionVersion.set(0);
    summaryFor.mockReset().mockReturnValue(of(ok(summary)));
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.overrideComponent(ApplicationReviewSummaryComponent, {
      set: { providers: [{ provide: ReviewsService, useValue: { sessionVersion, summaryFor } }] },
    });
  });
  async function create() {
    const fixture = TestBed.createComponent(ApplicationReviewSummaryComponent);
    fixture.componentRef.setInput('applicationId', 'app-one');
    fixture.componentRef.setInput('reviewsLink', '/apps/one/reviews');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('clears the previous average immediately when the application or account changes', async () => {
    const fixture = await create();
    expect(fixture.componentInstance.summary()).toEqual(summary);
    const pending = new Subject<Result<ReviewSummary, Error>>();
    summaryFor.mockReturnValue(pending);
    fixture.componentRef.setInput('applicationId', 'app-two');
    expect(fixture.componentInstance.summary()).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('4.5');
    sessionVersion.set(1);
    fixture.detectChanges();
    expect(summaryFor).toHaveBeenLastCalledWith('app-two');
    pending.next(ok({ total: 0, average: null, distribution: [0, 0, 0, 0, 0] }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No reviews yet');
    expect(fixture.nativeElement.textContent).not.toContain('0.0');
  });

  it('shows failure and permits retry even when an adapter throws', async () => {
    summaryFor.mockReturnValue(throwError(() => new Error('Unavailable')));
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('Member ratings unavailable');
    summaryFor.mockReturnValue(of(ok(summary)));
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-rating')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('4.5/5');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/apps/one/reviews');
  });
});
