import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'portal-not-found',
  standalone: true,
  imports: [RouterLink, TuiButton, TuiIcon],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundPageComponent {}
