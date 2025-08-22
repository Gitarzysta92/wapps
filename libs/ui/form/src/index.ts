// Chip Checkbox Component
export { ChipCheckboxComponent } from './chip-checkbox/chip-checkbox.component';

// Input Validation Component
export { InputValidationComponent } from './input-validation/input-validation.component';

// Multiselect Dropdown Component
export { MultiselectDropdownComponent } from './mutliselect-dropdown/multiselect-dropdown.component';

// Import components for the barrel export
import { ChipCheckboxComponent } from './chip-checkbox/chip-checkbox.component';
import { InputValidationComponent } from './input-validation/input-validation.component';
import { MultiselectDropdownComponent } from './mutliselect-dropdown/multiselect-dropdown.component';

// Re-export all components as a barrel export
export const FORM_COMPONENTS = [
  ChipCheckboxComponent,
  InputValidationComponent,
  MultiselectDropdownComponent
];
