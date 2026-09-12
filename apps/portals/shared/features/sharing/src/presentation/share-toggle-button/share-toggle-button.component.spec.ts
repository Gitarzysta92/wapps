import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SharingService } from '../../application/sharing.service';
import { ShareToggleButtonComponent } from './share-toggle-button.component';

describe('ShareToggleButtonComponent', () => {
  const service = { canShare: jest.fn(), contentUrl: jest.fn(), shareContent: jest.fn() };
  beforeEach(() => {
    service.canShare.mockReturnValue(false);
    service.contentUrl.mockReturnValue('https://portal.example/articles/design');
    service.shareContent.mockReturnValue(of({ ok: true, value: true }));
    TestBed.configureTestingModule({ imports: [ShareToggleButtonComponent], providers: [{ provide: SharingService, useValue: service }] });
  });
  function create() {
    const fixture = TestBed.createComponent(ShareToggleButtonComponent);
    fixture.componentRef.setInput('type', 'articles');
    fixture.componentRef.setInput('slug', 'design');
    fixture.componentRef.setInput('title', 'Design guide');
    fixture.detectChanges();
    return fixture;
  }
  it('renders a named native button and provides a selectable fallback link', () => {
    const fixture = create();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Share Design guide');
    expect(button.disabled).toBe(false);
    button.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input').value).toBe('https://portal.example/articles/design');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Select and copy');
  });
  it('does not show success for a cancelled share', () => {
    service.canShare.mockReturnValue(true);
    service.shareContent.mockReturnValue(of({ ok: true, value: false }));
    const fixture = create(); fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sharing cancelled');
  });
  it('prevents duplicate actions while an operation is running', () => {
    service.canShare.mockReturnValue(true);
    service.shareContent.mockClear().mockReturnValue(new Subject());
    const fixture = create();
    fixture.componentInstance.share(); fixture.componentInstance.share(); fixture.detectChanges();
    expect(service.shareContent).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
  });
});
