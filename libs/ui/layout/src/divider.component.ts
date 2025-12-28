import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-divider',
  standalone: true,
  template: `<hr [class]="'divider divider--' + variant + ' divider--' + spacing" />`,
  styles: [`
    :host {
      width: 100%;
      display: block;
    }
  
    .divider {
      border: none;
      border-top: 1px solid var(--tui-border-normal, #e0e0e0);
      margin: 0;
    }

    .divider--thin {
      border-top-width: 1px;
    }

    .divider--thick {
      border-top-width: 2px;
    }

    .divider--dashed {
      border-top-style: dashed;
    }

    .divider--dotted {
      border-top-style: dotted;
    }

    .divider--compact {
      margin: 0.5rem 0;
    }

    .divider--normal {
      margin: 1rem 0;
    }

    .divider--spacious {
      margin: 2rem 0;
    }
  `]
})
export class DividerComponent {
  @Input() variant: 'thin' | 'thick' | 'dashed' | 'dotted' = 'thin';
  @Input() spacing: 'compact' | 'normal' | 'spacious' = 'normal';
}

