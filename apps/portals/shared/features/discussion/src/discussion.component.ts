import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'discussion',
  templateUrl: './discussion.component.html',
  styleUrl: './discussion.component.scss',
  standalone: true,
  imports: [CommonModule]
})
export class DiscussionComponent {
  @Input() data: any;
}
