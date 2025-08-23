import { AbstractControl, ValidationErrors } from '@angular/forms';

export function equalValue(fieldNames: string[]) {
  return (control: AbstractControl): ValidationErrors | null => {
    if (fieldNames.length < 2) {
      return null;
    }

    const firstField = control.get(fieldNames[0]);
    if (!firstField) {
      return null;
    }

    const firstValue = firstField.value;

    for (let i = 1; i < fieldNames.length; i++) {
      const field = control.get(fieldNames[i]);
      if (!field) {
        return null;
      }

      if (field.value !== firstValue) {
        return { fieldsMismatch: true };
      }
    }

    return null;
  };
}




