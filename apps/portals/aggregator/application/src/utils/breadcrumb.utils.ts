import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';

/**
 * Replaces placeholders in breadcrumb labels with actual values.
 * 
 * @param breadcrumbs - Array of breadcrumb navigation items
 * @param replacements - Map of placeholder strings to replacement values
 * @returns New array of breadcrumbs with replaced labels
 * 
 * @example
 * ```typescript
 * const breadcrumbs = [
 *   { path: '/app', label: 'Application: :applicationName', icon: '@tui.box' }
 * ];
 * const replacements = {
 *   ':applicationName': 'My App'
 * };
 * const result = replaceBreadcrumbLabels(breadcrumbs, replacements);
 * // Result: [{ path: '/app', label: 'Application: My App', icon: '@tui.box' }]
 * ```
 */
export function replaceBreadcrumbLabels(
  breadcrumbs: NavigationDeclarationDto[],
  replacements: Record<string, string>
): NavigationDeclarationDto[] {
  if (!breadcrumbs.length || !Object.keys(replacements).length) {
    return breadcrumbs;
  }

  return breadcrumbs.map((breadcrumb) => {
    let label = breadcrumb.label;
    
    // Replace each placeholder in the label
    for (const [placeholder, value] of Object.entries(replacements)) {
      if (label.includes(placeholder)) {
        label = label.replace(placeholder, value);
      }
    }
    
    // Only create a new object if the label was actually changed
    if (label !== breadcrumb.label) {
      return {
        ...breadcrumb,
        label
      };
    }
    
    return breadcrumb;
  });
}

