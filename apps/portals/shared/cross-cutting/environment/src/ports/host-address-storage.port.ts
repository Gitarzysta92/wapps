import { InjectionToken } from "@angular/core";

export const HOST_ADDRESS_STORAGE = new InjectionToken<IHostAddressStorage>('HOST_ADDRESS_STORAGE');

export interface IHostAddressStorage {
  getRestApiAddress(): string;
  setRestApiAddress(address: string): void;
} 