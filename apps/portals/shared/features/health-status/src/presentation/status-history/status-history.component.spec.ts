import { TestBed } from '@angular/core/testing';
import { ApplicationHealthStatusCode } from '@domains/feed';
import { StatusHistoryComponent } from './status-history.component';

describe('status history presentation', () => {
  it('keeps original demo codes and gives unknown real observations a neutral, focusable UTC label', () => {
    const fixture = TestBed.createComponent(StatusHistoryComponent);
    fixture.componentRef.setInput('statusesHistory', [
      { status: ApplicationHealthStatusCode.Operational, timestamp: Date.UTC(2026, 9, 19) },
      { status: 'unknown', timestamp: Date.UTC(2026, 9, 19), label: '2026-10-19 UTC: Unknown; 0 of 288 intervals measured' },
    ]);
    fixture.detectChanges();
    const dots: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.status-dot');
    expect(dots[0].classList.contains('operational')).toBe(true);
    expect(dots[0].getAttribute('aria-label')).toBe('Operational on 2026-10-19 UTC');
    expect(dots[1].classList.contains('unknown')).toBe(true);
    expect(dots[1].classList.contains('operational')).toBe(false);
    expect(dots[1].tabIndex).toBe(0);
    expect(dots[1].title).toBe(dots[1].getAttribute('aria-label'));
    fixture.destroy();
  });
});
