import { ChangeDetectionStrategy, Component, ContentChild, ElementRef, inject, TemplateRef, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TuiActiveZone } from '@taiga-ui/cdk';
import { TUI_VIEWPORT, TuiAppearance, TuiButton, TuiDropdown, tuiDropdownOptionsProvider, TuiRectAccessor } from '@taiga-ui/core';

function cardViewport(): TuiRectAccessor {
  const element = inject(ElementRef<HTMLElement>).nativeElement;
  const viewport = inject(TUI_VIEWPORT, { skipSelf: true });

  return {
    type: 'dropdown',
    getClientRect: () => {
      // Let Taiga position and scroll popovers within the visible part of this card.
      const card = element.getBoundingClientRect();
      const screen = viewport.getClientRect();
      const left = Math.max(card.left, screen.left);
      const top = Math.max(card.top, screen.top);
      return new DOMRect(left, top,
        Math.max(0, Math.min(card.right, screen.right) - left),
        Math.max(0, Math.min(card.bottom, screen.bottom) - top));
    },
  };
}

@Component({
  selector: 'ui-medium-card',
  standalone: true,
  imports: [NgTemplateOutlet, TuiAppearance, TuiButton, TuiDropdown],
  providers: [
    { provide: TUI_VIEWPORT, useFactory: cardViewport },
    tuiDropdownOptionsProvider({ direction: 'top', minHeight: 0 }),
  ],
  templateUrl: './medium-card.component.html',
  styleUrl: './medium-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'medium-card'
  }
})
export class MediumCardComponent {
  @ContentChild('cardActions') actions?: TemplateRef<{ iconOnly: boolean }>;
  @ContentChild('cardFooterActions') footerActions?: TemplateRef<{ iconOnly: boolean; activeZone?: TuiActiveZone }>;
  // Projected templates keep their declaration injector, so nested popovers need the menu's active zone.
  @ViewChild('actionsToggle', { read: TuiActiveZone }) actionsZone?: TuiActiveZone;
  actionsOpen = false;
}
