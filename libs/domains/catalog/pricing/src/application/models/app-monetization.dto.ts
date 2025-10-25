export type AppMonetizationDto = {
  id: unknown,
  monetizations: MonetizationDto[]
}

export type MonetizationDto = {
  id: number,
  name: string
}