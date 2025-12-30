// Editorial domain TypeScript interfaces and enums
// Aligned with @domains/catalog types

export enum Device {
  Desktop = 0,
  Tablet = 1,
  Phone = 2,
  Smartwatch = 3,
  Tv = 4,
}

export enum Platform {
  Web = 1,
  IOS = 2,
  Android = 3,
  Windows = 4,
  Linux = 5,
  MacOS = 6,
}

export enum MonetizationModel {
  Free = 0,
  Freemium = 1,
  Subscription = 2,
  AdBased = 3,
  OneTimePurchase = 4,
  Fees = 5,
}

export enum Social {
  Facebook = 0,
  X = 1,
  Reddit = 2,
  Discord = 3,
  LinkedIn = 4,
  Medium = 5,
}

export enum Store {
  GooglePlay = 0,
  AppleStore = 1,
  AppGallery = 2,
  MicrosoftStore = 3,
}

export interface OrganizationProfileAssociation {
  id: number;
  organizationId: string;
}

export interface AppRecordAssociation {
  appRecordId: number;
  organizationProfileId: number;
  isSuspended: boolean;
}

export interface SocialLink {
  id: number;
  appRecordId: number;
  socialId: Social;
  url: string;
}

export interface StoreLink {
  id: number;
  storeId: Store;
  url: string;
  appRecordId: number;
}

export interface AppRecord {
  id: number;
  slug: string;
  name: string;
  description: string;
  website: string;
  isPwa: boolean;
  rating: number;
  estimatedNumberOfUsers?: number;
  isSuspended: boolean;
  logo: string;
  banner: string;
  screenshots: string[];
  organizationProfile?: OrganizationProfileAssociation;
  categoryId: number;
  tags: number[];
  stores: StoreLink[];
  socials: SocialLink[];
  devices: Device[];
}

export interface OrganizationProfile {
  id: number;
  organizationId?: string;
  name: string;
  url: string;
  description: string;
  phoneNumber: string;
  email: string;
  contactWebpage: string;
  avatar?: string;
  listingLimit: number;
  appRecordAssignments: AppRecordAssociation[];
}

export interface UserProfile {
  id: number;
  name: string;
  userId: string;
  avatar?: string;
}

export interface DeviceAssociation {
  id: number;
  deviceId: Device;
  appRecordId: number;
}

export interface PlatformAssociation {
  id: number;
  platformId: Platform;
  appRecordId: number;
}

export interface MonetizationAssociation {
  id: number;
  monetizationId: MonetizationModel;
  appRecordId: number;
}

export interface SuiteAssociation {
  id: number;
  suiteId: number;
  appRecordId: number;
}

export interface TagAssociation {
  id: number;
  tagId: number;
  appRecordId: number;
}

export interface AppRecordImageEntity {
  id: number;
  appRecordId: number;
  imageName: string;
}

export interface CategoryEntity {
  id: number;
  name: string;
  slug: string;
  parentId?: number;
  childCategories: CategoryEntity[];
  parentCategory?: CategoryEntity;
}

export interface TagEntity {
  id: number;
  name: string;
  slug: string;
}

export interface SuiteEntity {
  id: number;
  name: string;
}
