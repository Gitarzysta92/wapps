import { IdentityDto } from "./identity.dto";

export type IdentityState = {
  isIdentifying: boolean;
  identity: IdentityDto | null;
}

export const IDENTITY_DEFAULT_STATE: IdentityState = {
  isIdentifying: false,
  identity: null
}