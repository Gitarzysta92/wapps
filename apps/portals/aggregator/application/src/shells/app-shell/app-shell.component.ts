import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterPartialComponent } from '../../partials/footer/footer.component';
import { HeaderPartialComponent } from '../../partials/header/header.component';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  imports: [
    RouterOutlet,
    HeaderPartialComponent,
    FooterPartialComponent,
  ]
})
export class AppShellComponent {

}
