import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SharingService } from '../../application/sharing.service';
import { ShareToggleButtonComponent } from './share-toggle-button.component';

describe('ShareToggleButtonComponent', () => {
  const service = { canShareViaDevice: jest.fn(), contentUrl: jest.fn(), shareContent: jest.fn(), copyContent: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    service.canShareViaDevice.mockReturnValue(true);
    service.contentUrl.mockReturnValue('https://portal.example/articles/design');
    service.shareContent.mockReturnValue(of({ ok: true, value: true }));
    service.copyContent.mockReturnValue(of({ ok: true, value: true }));
    TestBed.configureTestingModule({ imports: [ShareToggleButtonComponent], providers: [
      { provide: SharingService, useValue: service },
    ] });
  });
  function create() {
    const fixture = TestBed.createComponent(ShareToggleButtonComponent);
    fixture.componentRef.setInput('type', 'articles');
    fixture.componentRef.setInput('slug', 'design');
    fixture.componentRef.setInput('title', 'Design guide');
    fixture.componentRef.setInput('iconOnly', true);
    fixture.detectChanges();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    trigger.click();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, trigger };
  }
  it('opens sharing options without starting either operation', () => {
    const { component, trigger } = create();
    expect(trigger.getAttribute('aria-label')).toBe('Share Design guide');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(component.linkUrl()).toBe('https://portal.example/articles/design');
    expect(component.deviceShareAvailable()).toBe(true);
    expect(service.shareContent).not.toHaveBeenCalled();
    expect(service.copyContent).not.toHaveBeenCalled();
  });
  it('copies only after the explicit copy action and keeps feedback outside the trigger', () => {
    const { fixture, component } = create();
    component.copy();
    fixture.detectChanges();
    expect(service.copyContent).toHaveBeenCalledWith('articles', 'design', undefined);
    expect(service.shareContent).not.toHaveBeenCalled();
    expect(component.message()).toBe('Link copied.');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
  it('reports cancellation only after an explicit device-share action', () => {
    service.shareContent.mockReturnValue(of({ ok: true, value: false }));
    const { fixture, component } = create();
    component.share();
    fixture.detectChanges();
    expect(service.shareContent).toHaveBeenCalledTimes(1);
    expect(component.message()).toBe('Sharing cancelled.');
    expect(fixture.nativeElement.textContent).not.toContain('Sharing cancelled.');
    component.setOpen(false);
    component.setOpen(true);
    expect(component.message()).toBe('');
  });
  it('disables device sharing when unavailable and provides the link after a failed copy', () => {
    service.canShareViaDevice.mockReturnValue(false);
    service.copyContent.mockReturnValue(of({ ok: false, error: new Error('Denied') }));
    const { fixture, component } = create();
    expect(component.deviceShareAvailable()).toBe(false);
    component.share();
    expect(service.shareContent).not.toHaveBeenCalled();
    component.copy();
    fixture.detectChanges();
    expect(component.fallbackUrl()).toBe('https://portal.example/articles/design');
    expect(component.message()).toContain('Select and copy');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });
  it('prevents repeated copy and device actions while an operation is running', () => {
    service.copyContent.mockReturnValue(new Subject());
    const { component } = create();
    component.copy();
    component.copy();
    component.share();
    expect(service.copyContent).toHaveBeenCalledTimes(1);
    expect(service.shareContent).not.toHaveBeenCalled();
    expect(component.isSharing()).toBe(true);
  });
});
