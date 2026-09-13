import { ChangeDetectionStrategy, Component, ContentChild, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TuiButton, TuiDropdown } from '@taiga-ui/core';

@Component({
  selector: 'ui-medium-card',
  standalone: true,
  imports: [NgTemplateOutlet, TuiButton, TuiDropdown],
  templateUrl: './medium-card.component.html',
  styleUrl: './medium-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'medium-card'
  }
})
export class MediumCardComponent {
  @ContentChild('cardActions') actions?: TemplateRef<unknown>;
  actionsOpen = false;
}
