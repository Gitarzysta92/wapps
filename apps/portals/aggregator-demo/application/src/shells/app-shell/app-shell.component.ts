import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterPartialComponent } from '../../partials/footer/footer.component';
import { HeaderPartialComponent } from '../../partials/header/header.component';
// Removed sticky state directive imports - using out-of-viewport approach instead

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
export class AppShellComponent implements OnInit {

  ngOnInit(): void {
    this.stickyTopOffset = this.height;
  }

  public height = 40;
  public stickyTopOffset = this.height;
  public isCollapsed = true;

  public onHeaderExpandedChange(isExpanded: boolean): void {
    this.stickyTopOffset = isExpanded ? 0 : this.height;
    this.isCollapsed = !isExpanded;
  }
}
