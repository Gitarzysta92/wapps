import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DiscoverySearchService } from '@portals/shared/features/search';
import { HeaderPartialComponent } from './header.component';

describe('global header search', () => {
  it('submits a labeled search form without a native reload and restores route queries', () => {
    const params = new BehaviorSubject(convertToParamMap({ search: 'Quick Task' }));
    const navigate = jest.fn();
    const remember = jest.fn();
    TestBed.configureTestingModule({ imports: [HeaderPartialComponent], providers: [
      { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      { provide: Router, useValue: { navigate } },
      { provide: DiscoverySearchService, useValue: { remember } },
    ] });
    const fixture = TestBed.createComponent(HeaderPartialComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(input.getAttribute('aria-label')).toBe('Search applications, articles and suites');
    expect(input.value).toBe('Quick Task');
    input.value = '  Photo   Snap ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/discover'], { queryParams: { search: 'Photo Snap' } });
    expect(remember).toHaveBeenCalledWith('Photo Snap');
    params.next(convertToParamMap({ search: 'restored' }));
    fixture.detectChanges();
    expect(input.value).toBe('restored');
    input.value = ' ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('waits for an explicit search, then submits the current value through the embedded button or Enter', fakeAsync(() => {
    const navigate = jest.fn();
    TestBed.configureTestingModule({ imports: [HeaderPartialComponent], providers: [
      { provide: ActivatedRoute, useValue: { queryParamMap: new BehaviorSubject(convertToParamMap({})) } },
      { provide: Router, useValue: { navigate } },
      { provide: DiscoverySearchService, useValue: { remember: jest.fn() } },
    ] });
    const fixture = TestBed.createComponent(HeaderPartialComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const button = fixture.nativeElement.querySelector('tui-textfield button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Search');
    input.value = 'photo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick(300);
    expect(navigate).not.toHaveBeenCalled();
    button.click();
    expect(navigate).toHaveBeenLastCalledWith(['/discover'], { queryParams: { search: 'photo' } });

    input.value = 'quick task';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenLastCalledWith(['/discover'], { queryParams: { search: 'quick task' } });
    expect(navigate).toHaveBeenCalledTimes(2);
    fixture.destroy();
  }));
});
