export interface INavigationDeclaration {
  id: number;
  path: string,
  label: string,
  icon: string,
  slots: Array<{ id: string, order: number }>
}