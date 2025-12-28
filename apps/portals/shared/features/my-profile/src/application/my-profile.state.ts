import { CustomerProfileDto } from "@domains/customer/profiles";

export type MyProfileState = {
  isLoading: boolean
  isError: boolean
  data: CustomerProfileDto
}