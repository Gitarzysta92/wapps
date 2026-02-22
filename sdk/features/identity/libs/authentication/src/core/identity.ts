import { IIdentityNode } from '@sdk/kernel/ontology/identity';
import { IIdentitySubject } from '@sdk/kernel/ontology/identity';

export class Identity implements IIdentitySubject, IIdentityNode {


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

  constructor(args: IIdentitySubject & IIdentityNode) {
    this.id = args.id;
    this.identityId = args.identityId;
    this.claim = args.claim;
    this.kind = args.kind;
    this.isActive = args.isActive;
    this.isSuspended = args.isSuspended;
    this.isDeleted = args.isDeleted;
    this.providerType = args.providerType;
    this.providerSecret = args.providerSecret;
    this.createdAt = args.createdAt;
    this.updatedAt = args.updatedAt;
    this.deletedAt = args.deletedAt;
  }

  static create(args: IIdentitySubject & IIdentityNode): Identity {
    return new Identity(args);
  }

  isValid(): boolean {
    return this.isActive && !this.isSuspended && !this.isDeleted;
  }

  canBeObtained(): boolean {
    return this.isValid() && this.createdAt > 0;
  }

  activate() {
    this.isActive = true;
  }

}