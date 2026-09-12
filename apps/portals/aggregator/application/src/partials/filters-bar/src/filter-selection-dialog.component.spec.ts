import { ComponentFixture, TestBed } from '@angular/core/testing';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { FilterSelectionDialogComponent } from './filter-selection-dialog.component';

describe('searchable filter selection', () => {
  const items = [
    { name: 'Alpha', value: 'alpha', isSelected: false },
    { name: 'Beta', value: 'beta', isSelected: false },
    { name: 'Gamma', value: 'gamma', isSelected: true },
  ];

  async function setup(filterId = 'category') {
    const completeWith = jest.fn();
    TestBed.configureTestingModule({ imports: [FilterSelectionDialogComponent], providers: [
      { provide: POLYMORPHEUS_CONTEXT, useValue: {
        data: { filterId, filterName: 'Options', items, options: [], placeholder: 'Search options...' },
        completeWith,
      } },
    ] });
    const fixture = TestBed.createComponent(FilterSelectionDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, completeWith };
  }

  async function search(fixture: ComponentFixture<FilterSelectionDialogComponent>, value: string) {
    const input = fixture.nativeElement.querySelector('tui-textfield input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function toggleVisibleOption(fixture: ComponentFixture<FilterSelectionDialogComponent>) {
    fixture.nativeElement.querySelector('input[type="checkbox"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it.each(['category', 'platform', 'device', 'monetization', 'social', 'estimated-users', 'tag'])(
    'searches the %s picker without changing its selected values', async filterId => {
      const { fixture, completeWith } = await setup(filterId);
      await search(fixture, '  bEtA  ');
      expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
      expect(fixture.nativeElement.querySelector('.items-list').textContent.trim()).toBe('Beta');
      expect(fixture.nativeElement.querySelector('.selected-options').textContent.trim()).toBe('Gamma');
      fixture.componentInstance.onApply();
      expect(completeWith).toHaveBeenCalledWith({ filterId, selected: [items[2]] });
    },
  );

  it('keeps multiple choices across searches and applies only when requested', async () => {
    const { fixture, completeWith } = await setup();
    await search(fixture, 'alpha');
    await toggleVisibleOption(fixture);
    await search(fixture, 'beta');
    await toggleVisibleOption(fixture);
    expect(completeWith).not.toHaveBeenCalled();
    await search(fixture, '');
    expect([...fixture.nativeElement.querySelectorAll('input[type="checkbox"]')]
      .map(input => (input as HTMLInputElement).checked)).toEqual([true, true, true]);
    fixture.componentInstance.onApply();
    expect(completeWith.mock.calls[0][0].selected.map((item: { value: string }) => item.value))
      .toEqual(['gamma', 'alpha', 'beta']);
    expect(items.map(item => item.isSelected)).toEqual([false, false, true]);
  });

  it('shows an empty result and restores the full list when the query is cleared', async () => {
    const { fixture } = await setup();
    await search(fixture, 'no match');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('No options match');
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    await search(fixture, '');
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('tui-textfield input').value).toBe('');
  });

  it('discards changes when cancelled', async () => {
    const { fixture, completeWith } = await setup();
    await search(fixture, 'alpha');
    await toggleVisibleOption(fixture);
    fixture.componentInstance.onCancel();
    expect(completeWith).toHaveBeenCalledWith(undefined);
    expect(items[0].isSelected).toBe(false);
  });

  it('removes a selected option from the summary even when search hides its checkbox', async () => {
    const { fixture, completeWith } = await setup();
    await search(fixture, 'beta');
    fixture.nativeElement.querySelector('button[aria-label="Remove Gamma"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.selection-summary').textContent).toContain('No options selected');
    expect(fixture.nativeElement.querySelector('tui-textfield input').value).toBe('beta');
    expect(completeWith).not.toHaveBeenCalled();
    fixture.componentInstance.onApply();
    expect(completeWith).toHaveBeenCalledWith({ filterId: 'category', selected: [] });
  });
});
