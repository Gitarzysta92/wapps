import { NgIf, NgForOf } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiIcon } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge, TuiRating } from '@taiga-ui/kit';
import { TuiCard } from '@taiga-ui/layout';

@Component({
  selector: '[app-medium-tile]',
  templateUrl: './app-medium-tile.component.html',
  styleUrl: './app-medium-tile.component.scss',
  imports: [
    FormsModule,
    TuiCard,
    TuiAvatar,
    TuiBadge,
    TuiRating,
    NgIf,
    NgForOf,
    TuiIcon,
  ],
})
export class AppMediumTileComponent implements OnInit {
  @Input() app: any;

  ngOnInit(): void {
  }
}
