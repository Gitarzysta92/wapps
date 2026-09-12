import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DiscoverySearchService } from '@portals/shared/features/search';
import { HeaderPartialComponent } from './header.component';

describe('global header search', () => {
  it('keeps listing searches in their route, preserves filters, and clears/restores URL queries', fakeAsync(() => {
    const params = new BehaviorSubject(convertToParamMap({ q: 'architecture', category: 'design', page: '2' }));
    const route = { queryParamMap: params };
    const navigate = jest.fn();
    TestBed.configureTestingModule({ imports: [HeaderPartialComponent], providers: [
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: { navigate } },
      { provide: DiscoverySearchService, useValue: { remember: jest.fn() } },
    ] });
    const fixture = TestBed.createComponent(HeaderPartialComponent);
    fixture.componentRef.setInput('searchWithinPage', true);
    fixture.componentRef.setInput('searchLabel', 'Search articles');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Search articles');
    expect(input.value).toBe('architecture');
    input.value = '  design  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick(300);
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: route, queryParamsHandling: 'merge', queryParams: { search: 'design', q: null, page: 1 },
    });
    params.next(convertToParamMap({ search: 'design', category: 'design', page: '1' }));
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    tick(300);
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: route, queryParamsHandling: 'merge', queryParams: { search: null, q: null, page: 1 },
    });
    params.next(convertToParamMap({ q: 'architecture', category: 'design', page: '2' }));
    fixture.detectChanges();
    expect(input.value).toBe('architecture');
    fixture.destroy();
  }));

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
