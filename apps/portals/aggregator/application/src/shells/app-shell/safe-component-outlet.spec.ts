import { ChangeDetectionStrategy, Component, Input, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SafeComponentOutletDirective } from '@ui/misc';

@Component({
  selector: 'test-shell-slot',
  template: '{{ title }} / {{ submenu() }}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ShellSlot {
  @Input('label') title = 'Default';
  submenu = input('Default submenu');
}

@Component({
  imports: [SafeComponentOutletDirective],
  template: '<ng-container [safeComponentOutlet]="component" [safeComponentOutletInputs]="inputs" />',
})
class Host {
  component: typeof ShellSlot | null = ShellSlot;
  inputs: Record<string, unknown> = { label: 'Explore', submenu: 'Settings', unrelatedRouteData: true };
}

describe('Shell component outlet', () => {
  it('keeps the navigation instance when only route metadata disappears', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const slot = fixture.debugElement.query(By.directive(ShellSlot)).componentInstance;
    expect(fixture.nativeElement.textContent).toBe('Explore / Settings');

    fixture.componentInstance.inputs = { label: 'Discover', submenu: 'Settings' };
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(ShellSlot)).componentInstance).toBe(slot);
    expect(fixture.nativeElement.textContent).toBe('Discover / Settings');
  });

  it('still restores defaults when a declared route input disappears', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.componentInstance.inputs = { label: 'Discover' };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('Discover / Default submenu');
    fixture.componentInstance.component = null;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(ShellSlot))).toBeNull();
  });
});
