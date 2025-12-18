import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-fade-out-excerpt',
  standalone: true,
  imports: [],
  templateUrl: './fade-out-excerpt.component.html',
  styleUrl: './fade-out-excerpt.component.scss'
})
export class FadeOutExcerptComponent {
  excerpt = input.required<string>();
  maxLength = input<number | undefined>(undefined);
  
  getTruncatedExcerpt(): string {
    const text = this.excerpt();
    const max = this.maxLength();
    
    if (!max || text.length <= max) {
      return text;
    }
    
    return text.substring(0, max);
  }
}
