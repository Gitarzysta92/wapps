/**
 * Customer Profile Domain Models
 */

export type ProfileBadgeDto = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};

export type ProfileAvatarDto = {
  uri: string;
  alt: string;
};

export type ProfileSocialLinksDto = {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  github?: string;
  medium?: string;
  website?: string;
};

export type ProfileStatsDto = {
  totalDiscussions: number;
  totalFavorites: number;
  totalSuites: number;
  totalArticles: number;
};

export type CustomerProfileDto = {
  id: string;
  name: string;
  avatar?: ProfileAvatarDto;
  badges?: ProfileBadgeDto[];

  // Extended profile fields
  bio?: string;
  email?: string;
  location?: string;
  socialLinks?: ProfileSocialLinksDto;

  // Metadata
  joinedAt?: Date;
  lastActiveAt?: Date;

  // Statistics (computed server-side)
  stats?: ProfileStatsDto;
};

/**
 * DTO for profile updates (only editable fields)
 */
export type UpdateCustomerProfileDto = {
  name?: string;
  avatar?: ProfileAvatarDto;
  bio?: string;
  location?: string;
  socialLinks?: ProfileSocialLinksDto;
};
