import {NgIf} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TuiIcon, TuiTextfield} from '@taiga-ui/core';
import {TuiChevron, TuiDataListWrapper, TuiSelect, TuiTooltip} from '@taiga-ui/kit';
import { RouteDrivenContainerDirective } from '../../../../../libs/ui/routing/route-driven-container.directive';
@Component({
  selector: 'sorting-select',
  templateUrl: './sorting-select.component.html',
  styleUrl: './sorting-select.component.scss',
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  imports: [
    FormsModule,
    NgIf,
    TuiChevron,
    TuiDataListWrapper,
    TuiIcon,
    TuiSelect,
    TuiTextfield,
    TuiTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingSelectComponent {

  @Input() selectedOption: string[] = [];
  @Output() onUpdate: EventEmitter<{ sort: string }> = new EventEmitter();

  protected readonly users = [
    'Dmitriy Demenskiy',
    'Alex Inkin',
    'Vladimir Potekhin',
    'Nikita Barsukov',
    'Maxim Ivanov',
    'German Panov',
  ];

  protected value: string | null = null;
}
