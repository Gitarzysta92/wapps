import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterPartialComponent } from '../../partials/footer/footer.component';
import { HeaderPartialComponent } from '../../partials/header/header.component';
import { StickyStateDirective, StickyStateChange } from '@ui/misc';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  imports: [
    RouterOutlet,
    HeaderPartialComponent,
    FooterPartialComponent,
    StickyStateDirective,
  ]
})
export class AppShellComponent implements OnInit {

  ngOnInit(): void {
    this.stickyTopOffset = this.height;
  }

  public height = 40;
  public stickyTopOffset = this.height;
  public isCollapsed = true;
  public isSticky = false;


  public onHeaderStickyStateChange(event: StickyStateChange): void {
    this.isSticky = event.isSticky;
    console.log('Header sticky state:', {
      isSticky: event.isSticky,
      distanceFromTop: event.distanceFromTop
    });
  }

  public onHeaderExpandedChange(isExpanded: boolean): void {
    this.stickyTopOffset = isExpanded ? 0 : this.height;
    this.isCollapsed = !isExpanded;
  }
}
