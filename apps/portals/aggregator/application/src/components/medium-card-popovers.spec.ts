import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TUI_VIEWPORT, TuiDropdownPosition } from '@taiga-ui/core';
import { MediumCardComponent } from '@ui/layout';
import { AttributionInfoBadgeComponent, mapAttributionToVM } from '@portals/shared/features/attribution';
import { AttributionType, ContentNature } from '@domains/publication/attribution';

@Component({
  imports: [MediumCardComponent, AttributionInfoBadgeComponent],
  template: `
    <ui-medium-card>
      <p>Tile content</p>
      <attribution-info-badge slot="bottom-bar" [attribution]="attribution" />
      <ng-template #cardActions><button type="button">View item</button></ng-template>
    </ui-medium-card>
  `,
})
class TestTile {
  readonly attribution = mapAttributionToVM({
    attributionType: AttributionType.HUMAN_CREATED,
    contentNature: ContentNature.ORGANIC,
    disclosureRequired: false,
  });
}

describe('Tile popover placement', () => {
  const browserRect = globalThis.DOMRect;
  beforeAll(() => {
    // This workspace's jsdom version does not provide the browser constructor.
    globalThis.DOMRect = jest.fn((x = 0, y = 0, width = 0, height = 0) => {
      const bounds = { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
      return { ...bounds, toJSON: () => bounds };
    }) as unknown as typeof DOMRect;
  });
  afterAll(() => { globalThis.DOMRect = browserRect; });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{
        provide: TUI_VIEWPORT,
        useValue: { type: 'viewport', getClientRect: () => new DOMRect(0, 0, 320, 844) },
      }],
    });
  });

  it.each(['.card-actions-toggle', '.attribution-badge-trigger'])(
    'keeps %s above its toolbar and inside the tile', selector => {
      const fixture = TestBed.createComponent(TestTile);
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('ui-medium-card') as HTMLElement;
      jest.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(12, 180, 296, 360));
      const trigger = fixture.debugElement.query(By.css(selector));
      jest.spyOn(trigger.nativeElement, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(selector.includes('attribution') ? 204 : 252, 480, 44, 44));

      const [top, left] = trigger.injector.get(TuiDropdownPosition).getPosition(new DOMRect(0, 0, 240, 96));

      expect(top).toBeGreaterThanOrEqual(180);
      expect(top + 96).toBeLessThanOrEqual(480);
      expect(left).toBeGreaterThanOrEqual(12);
      expect(left + 240).toBeLessThanOrEqual(308);
    },
  );

  it('uses only the visible card area after scrolling or resizing', () => {
    const fixture = TestBed.createComponent(TestTile);
    fixture.detectChanges();
    const card = fixture.debugElement.query(By.directive(MediumCardComponent));
    const bounds = jest.spyOn(card.nativeElement, 'getBoundingClientRect');
    const viewport = card.injector.get(TUI_VIEWPORT);

    bounds.mockReturnValue(new DOMRect(12, -200, 296, 600));
    expect(viewport.getClientRect().toJSON()).toMatchObject({ x: 12, y: 0, width: 296, height: 400 });
    bounds.mockReturnValue(new DOMRect(-20, 600, 400, 500));
    expect(viewport.getClientRect().toJSON()).toMatchObject({ x: 0, y: 600, width: 320, height: 244 });
  });
});
