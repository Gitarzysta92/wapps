import { ProfileDto } from "@domains/customer/profiles";

export type MyProfileState = {
  isLoading: boolean
  isError: boolean
  data: ProfileDto
}