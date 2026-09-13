import { ContentStateComponent } from '@ui/layout';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, } from '@taiga-ui/core';

@Component({
  selector: 'portal-not-found',
  standalone: true,
  imports: [ContentStateComponent, RouterLink, TuiButton, ],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundPageComponent {}
