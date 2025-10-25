export type AppReferencesDto = {
  id: unknown,
  name: string,
  references: ReferenceDto[]
}


export type ReferenceDto = {
  id: number,
  name: string;
  type: string;
}
