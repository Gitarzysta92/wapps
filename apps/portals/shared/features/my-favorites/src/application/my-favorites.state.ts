import { CustomerFavoritesDto } from "@domains/customer/favorites";

export type MyFavoritesState = {
  isLoading: boolean
  isError: boolean
  data: CustomerFavoritesDto
}

