import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-excerpt',
  standalone: true,
  imports: [],
  templateUrl: './excerpt.component.html',
  styleUrl: './excerpt.component.scss'
})
export class ExcerptComponent {
  excerpt = input.required<string>();
  maxLength = input<number | undefined>(undefined);
  
  getTruncatedExcerpt(): string {
    const text = this.excerpt();
    const max = this.maxLength();
    
    if (!max || text.length <= max) {
      return text;
    }
    
    return text.substring(0, max) + '...';
  }
}


