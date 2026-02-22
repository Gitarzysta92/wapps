export type IdentityCreationDto = {
  provider: string;
  claim: string;
  identityType: string;
  kind?: string;
};
