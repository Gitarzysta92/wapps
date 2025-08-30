import { inject, Injectable } from "@angular/core"
import { HOST_ADDRESS_STORAGE } from "./ports/host-address-storage.port";
import { ENVIRONMENT_TYPE } from "./ports/environment-type.port";

@Injectable()
export class EnvironmentService {

  private readonly addressStorage = inject(HOST_ADDRESS_STORAGE);
  private readonly environment = inject(ENVIRONMENT_TYPE);

  public isProduction(): boolean {
    return this.environment.isProduction;
  }
  public isDevelopment(): boolean {
    return this.environment.isDevelopment;
  }

  public getRestApiAddress(): string {
    return this.addressStorage.getRestApiAddress();
  }
}