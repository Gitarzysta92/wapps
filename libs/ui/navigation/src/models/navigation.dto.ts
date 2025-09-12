export type NavigationDeclaration = {
  id: number;
  path: string,
  label: string,
  icon: string,
  slots: Array<{ id: string, order: number }>
}