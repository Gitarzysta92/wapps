import {
  Directive,
  Input,
  ViewContainerRef,
  Type,
  OnChanges,
  SimpleChanges,
  ComponentRef,
  inject,
  DestroyRef,
  effect
} from '@angular/core';

@Directive({
  selector: '[safeComponentOutlet]',
  standalone: true,
})
export class SafeComponentOutletDirective implements OnChanges {
  @Input('safeComponentOutlet') component: Type<any> | null | undefined;
  @Input('safeComponentOutletInputs') inputs: Record<string, any> = {};

  private vcr = inject(ViewContainerRef);

  private cmpRef?: ComponentRef<any>;
  private validInputs: string[] = [];

  ngOnChanges(changes: SimpleChanges) {
    // 1. If component type changed → recreate
    if (changes['component']) {
      this.createOrReplaceComponent();
    }

    // 2. Always patch inputs into the current instance
    if (this.cmpRef) {
      this.applyInputs();
      this.cmpRef.changeDetectorRef.detectChanges();
    }
  }

  private createOrReplaceComponent() {
    // blow away previous component if the type changed
    this.vcr.clear();
    this.cmpRef = undefined;
    this.validInputs = [];

    // If component is null/undefined, just clear and return
    if (!this.component) {
      return;
    }

    this.cmpRef = this.vcr.createComponent(this.component);



    // cache valid input names once per component class
    // NOTE: in Angular 17+, you can read inputs off the component def:
    // (cmpRef.componentType as any).ɵcmp.inputs
    this.validInputs = this.getDeclaredInputs(this.cmpRef);

    // first-time input push happens in ngOnChanges afterwards
  }

  private applyInputs() {
    for (const input of this.validInputs) {
      if (input[0] in this.inputs) {

        this.cmpRef?.setInput(input[0], this.inputs[input[0]]);
      }
    }

  }

  private getDeclaredInputs(cmpRef: ComponentRef<any>): string[] {
    // Works in modern Angular (v15+ view engine removed):
    const def = (cmpRef.componentType as any)?.ɵcmp;
    if (!def) {
      return [];
    }
    // def.inputs is an object: { publicInputName: internalPropName, ... }
    // We want the instance prop names:
    return Object.values(def.inputs ?? {}) as string[];
  }
}
