import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiButton } from '@taiga-ui/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { LOCAL_APPLICATION_DATA } from '@portals/shared/features/application-overview';
import { ApplicationReviewsPageComponent } from './application-reviews-page.component';

// Keep the production template and native button bindings; omit unrelated visual widgets.
describe('review helpful controls', () => {
  let fixture: ComponentFixture<ApplicationReviewsPageComponent>;
  const helpfulButton = () => Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
    .find(button => button.textContent?.includes('Helpful ('))!;
  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: LOCAL_APPLICATION_DATA, useValue: true }] });
    TestBed.overrideComponent(ApplicationReviewsPageComponent, { set: { imports: [CommonModule, TuiButton], schemas: [NO_ERRORS_SCHEMA] } });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(ApplicationReviewsPageComponent);
    fixture.componentRef.setInput('appSlug', 'photo-snap');
  });
  afterEach(() => jest.restoreAllMocks());

  it('toggles the actual pressed button and persists one mark, scoped to the app', async () => {
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const button = helpfulButton();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('Helpful (43)');
    expect(button.getAttribute('data-appearance')).toBe('primary');
    expect(JSON.parse(localStorage.getItem('wapps.review-helpful.photo-snap')!)).toEqual(['1']);
    fixture.componentRef.setInput('appSlug', 'quick-task'); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(helpfulButton().getAttribute('aria-pressed')).toBe('false');
    fixture.componentRef.setInput('appSlug', 'photo-snap'); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(helpfulButton().getAttribute('aria-pressed')).toBe('true');
    helpfulButton().click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(helpfulButton().textContent).toContain('Helpful (42)');
    expect(JSON.parse(localStorage.getItem('wapps.review-helpful.photo-snap')!)).toEqual([]);
  });

  it('keeps the rendered state unchanged and shows an alert when saving fails', async () => {
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    helpfulButton().click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(helpfulButton().getAttribute('aria-pressed')).toBe('false');
    expect(helpfulButton().textContent).toContain('Helpful (42)');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Could not save');
    write.mockRestore();
    helpfulButton().click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(helpfulButton().getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not overwrite unreadable saved marks', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    const write = jest.spyOn(Storage.prototype, 'setItem');
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(helpfulButton().disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Could not load');
    fixture.componentInstance.toggleHelpful('1');
    expect(write).not.toHaveBeenCalled();
  });
});
