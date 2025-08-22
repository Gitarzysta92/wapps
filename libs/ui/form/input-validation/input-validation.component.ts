import { NgIf, NgFor } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'input-validation',
  imports: [
    NgIf,
    NgFor,
  ],
  templateUrl: './input-validation.component.html',
  styleUrl: './input-validation.component.scss'
})
export class InputValidationComponent {
  @Input() control: AbstractControl | null = null;
  @Input() messages: Array<{ type: string, message: string }> = [];
}
