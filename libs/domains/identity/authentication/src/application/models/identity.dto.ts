export type IdentityDto = {
  id: string;
  identityId: string;
  claim: string;
  kind: string;
  isActive: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  providerType: string;
  providerSecret?: string | undefined;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}