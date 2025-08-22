import { NgIf, NgForOf } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiDialogService, TuiDialogContext, TuiIcon } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge, TuiRating } from '@taiga-ui/kit';
import { TuiCard } from '@taiga-ui/layout';
import { injectContext } from '@taiga-ui/polymorpheus';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-details-dialog',
  templateUrl: './app-details-dialog.component.html',
  styleUrl: './app-details-dialog.component.scss',
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
export class AppDetailsDialogComponent implements OnInit {
  private readonly dialogs = inject(TuiDialogService);

  public readonly context = injectContext<TuiDialogContext<unknown, { app: any }>>();


  ngOnInit(): void {
    console.log(this.context?.data);
  }
}
