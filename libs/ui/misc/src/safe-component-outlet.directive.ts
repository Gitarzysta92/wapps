import {
  Directive,
  Input,
  ViewContainerRef,
  Type,
  OnChanges,
  SimpleChanges,
  ComponentRef,
  inject,
  reflectComponentType
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
    // Recreate when route inputs disappear so the component's defaults are restored.
    // Patching only supplied inputs would retain the previous route's submenu.
    const inputChange = changes['inputs'];
    const removedInput = inputChange && this.validInputs.some(key =>
      key in (inputChange.previousValue ?? {}) && !(key in (inputChange.currentValue ?? {})));
    if (changes['component'] || removedInput) {
      this.createOrReplaceComponent();
    }

    // 2. Always patch inputs into the current instance
    if (this.cmpRef) {
      this.applyInputs();
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



    // Use public input names, including aliases and signal inputs.
    this.validInputs = reflectComponentType(this.component)?.inputs.map(input => input.templateName) ?? [];

    // first-time input push happens in ngOnChanges afterwards
  }

  private applyInputs() {
    for (const input of this.validInputs) {
      if (input in this.inputs) {

        this.cmpRef?.setInput(input, this.inputs[input]);
      }
    }

  }

}
