import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, NgZone, viewChild } from '@angular/core';
import { createNebulaCanvas } from './nebula-canvas';

@Component({
  selector: 'ui-animated-background',
  templateUrl: './animated-background.component.html',
  styleUrl: './animated-background.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnimatedBackgroundComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => {
      this.destroyRef.onDestroy(createNebulaCanvas(this.canvas().nativeElement, this.host.nativeElement));
    }));
  }
}
