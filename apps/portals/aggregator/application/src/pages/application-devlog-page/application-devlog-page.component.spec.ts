import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationDevlogPageComponent } from './application-devlog-page.component';

describe('release browsing', () => {
  async function page(version?: string) {
    TestBed.configureTestingModule({providers: [provideRouter([])]});
    const fixture = TestBed.createComponent(ApplicationDevlogPageComponent);
    fixture.componentRef.setInput('appSlug', 'photo-snap');
    if (version) fixture.componentRef.setInput('version', version);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('separates stable releases, expands the list and hides Load more when exhausted', async () => {
    const fixture = await page();
    const stable = () => fixture.nativeElement.querySelector('[aria-labelledby="stable-title"]');
    expect(stable().querySelectorAll('ui-medium-card')).toHaveLength(2);
    expect(stable().textContent).not.toContain('beta');
    stable().querySelector('button').click();
    fixture.detectChanges();
    expect(stable().querySelectorAll('ui-medium-card')).toHaveLength(3);
    expect(stable().querySelector('button')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-labelledby="releases-title"]').textContent).toContain('2.2.0-beta.1');
    expect(fixture.nativeElement.textContent).not.toContain('Previous releases');
  });
  it('shows only older versions on the selected release details', async () => {
    const fixture = await page('2.1.0');
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Release v2.1.0');
    const previous = fixture.nativeElement.querySelector('[aria-labelledby="previous-title"]');
    expect(previous.textContent).toContain('2.0.3');
    expect(previous.textContent).not.toContain('2.2.0-beta.1');
    expect(fixture.nativeElement.querySelector('[aria-labelledby="stable-title"]')).toBeNull();
  });
  it('handles a missing release without showing another version', async () => {
    const fixture = await page('missing');
    expect(fixture.nativeElement.textContent).toContain('Release not found');
    expect(fixture.nativeElement.querySelector('[aria-label="Release notes"]')).toBeNull();
  });
});
