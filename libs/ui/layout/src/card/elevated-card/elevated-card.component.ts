import { Component, Input } from '@angular/core';

@Component({
  selector: 'elevated-card',
  templateUrl: './elevated-card.component.html',
  styleUrl: './elevated-card.component.scss',
  standalone: true,
})
export class ElevatedCardComponent {
  @Input() item: any | undefined;
  @Input() icon: string | undefined;
}



