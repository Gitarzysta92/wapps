import { Component, input } from '@angular/core';
import { TuiAvatar } from '@taiga-ui/kit';

export interface ArticleAuthor {
  name: string;
  avatarUrl: string;
}

@Component({
  selector: 'article-author-info',
  standalone: true,
  imports: [TuiAvatar],
  templateUrl: './article-author-info.component.html',
  styleUrl: './article-author-info.component.scss'
})
export class ArticleAuthorInfoComponent {
  author = input.required<ArticleAuthor>();
}


