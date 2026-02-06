import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'discussion-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  standalone: true,
  imports: [CommonModule],
})
export class FooterPartialComponent {
  public readonly currentYear = new Date().getFullYear();
}

