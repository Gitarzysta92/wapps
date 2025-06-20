// Listing domain TypeScript interfaces and enums

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

export interface AppListingAssociation {
  appListingId: number;
  organizationProfileId: number;
  isSuspended: boolean;
}

export interface SocialLink {
  // Add fields as needed
}

export interface StoreLink {
  // Add fields as needed
}

export interface AppListing {
  id: number;
  organizationProfile?: OrganizationProfileAssociation;
  categoryId: number;
  tags: number[];
  isPwa: boolean;
  rating: number;
  website: string;
  name: string;
  description: string;
  estimatedNumberOfUsers?: number;
  isSuspended: boolean;
  logo: string;
  banner: string;
  screenshots: string[];
  stores: SocialLink[];
  socials: StoreLink[];
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
  appListingAssignments: AppListingAssociation[];
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
  appListingId: number;
}

export interface PlatformAssociation {
  id: number;
  platformId: Platform;
  appListingId: number;
}

export interface MonetizationAssociation {
  id: number;
  monetizationId: MonetizationModel;
  appListingId: number;
}

export interface SuiteAssociation {
  id: number;
  suiteId: number;
  appListingId: number;
}

export interface TagAssociation {
  id: number;
  tagId: number;
  appListingId: number;
}

export interface SocialLinkEntity {
  id: number;
  appListingId: number;
  socialId: Social;
  url: string;
}

export interface StoreLinkEntity {
  id: number;
  storeId: Store;
  url: string;
  appListingId: number;
}

export interface AppListingImageEntity {
  id: number;
  appListingId: number;
  imageName: string;
}

export interface CategoryEntity {
  id: number;
  name: string;
  parentId?: number;
  childCategories: CategoryEntity[];
  parentCategory?: CategoryEntity;
}

export interface TagEntity {
  id: number;
  name: string;
}

export interface SuiteEntity {
  id: number;
  name: string;
} 