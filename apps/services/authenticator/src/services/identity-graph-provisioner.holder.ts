import { Injectable } from '@nestjs/common';
import { IIdentityGraphProvisioner } from '@domains/identity/authentication';

@Injectable()
export class IdentityGraphProvisionerHolder {
  private provisioner: IIdentityGraphProvisioner | undefined;

  set(provisioner: IIdentityGraphProvisioner | undefined): void {
    this.provisioner = provisioner;
  }

  get(): IIdentityGraphProvisioner | undefined {
    return this.provisioner;
  }
}

