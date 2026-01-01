/**
 * Customer Preferences Domain Models
 * Contains all user-configurable settings and preferences
 */

// ============ Display Preferences ============

export type ThemePreference = 'light' | 'dark' | 'auto';
export type DateFormatPreference = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type ViewModePreference = 'grid' | 'list';
export type FeedSortPreference = 'recent' | 'popular' | 'recommended';
export type FontSizePreference = 'small' | 'medium' | 'large' | 'x-large';

export type DisplayPreferencesDto = {
  theme: ThemePreference;
  language: string;
  timezone: string;
  dateFormat: DateFormatPreference;
  defaultView: ViewModePreference;
  itemsPerPage: number;
};

// ============ Content Preferences ============

export type ContentFiltersDto = {
  preferredCategories: string[];
  excludedCategories: string[];
  preferredTags: string[];
};

export type ContentPreferencesDto = {
  feedSortOrder: FeedSortPreference;
  showMatureContent: boolean;
  contentFilters: ContentFiltersDto;
};

// ============ Notification Preferences ============

export type EmailNotificationFrequency = 'instant' | 'daily' | 'weekly' | 'never';

export type EmailNotificationPreferencesDto = {
  enabled: boolean;
  frequency: EmailNotificationFrequency;
  newDiscussions: boolean;
  discussionReplies: boolean;
  newArticles: boolean;
  favoriteUpdates: boolean;
  suiteUpdates: boolean;
  systemAnnouncements: boolean;
  weeklyDigest: boolean;
};

export type InAppNotificationPreferencesDto = {
  enabled: boolean;
  discussionMentions: boolean;
  discussionReplies: boolean;
  favoriteUpdates: boolean;
  systemAlerts: boolean;
};

export type PushNotificationPreferencesDto = {
  enabled: boolean;
  criticalOnly: boolean;
};

export type NotificationPreferencesDto = {
  email: EmailNotificationPreferencesDto;
  inApp: InAppNotificationPreferencesDto;
  push: PushNotificationPreferencesDto;
};

// ============ Privacy Preferences ============

export type ProfileVisibility = 'public' | 'private' | 'followers';

export type PrivacyPreferencesDto = {
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  showBadges: boolean;
  showActivityHistory: boolean;
  showFavorites: boolean;
  showDiscussions: boolean;
  showSuites: boolean;
  allowAnalytics: boolean;
  allowPersonalization: boolean;
};

// ============ Accessibility Preferences ============

export type AccessibilityPreferencesDto = {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: FontSizePreference;
  screenReaderOptimized: boolean;
};

// ============ Complete Customer Preferences ============

export type CustomerPreferencesDto = {
  display: DisplayPreferencesDto;
  content: ContentPreferencesDto;
  notifications: NotificationPreferencesDto;
  privacy: PrivacyPreferencesDto;
  accessibility: AccessibilityPreferencesDto;
};

// ============ Default Values ============

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferencesDto = {
  theme: 'auto',
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'DD/MM/YYYY',
  defaultView: 'grid',
  itemsPerPage: 20,
};

export const DEFAULT_CONTENT_PREFERENCES: ContentPreferencesDto = {
  feedSortOrder: 'recent',
  showMatureContent: false,
  contentFilters: {
    preferredCategories: [],
    excludedCategories: [],
    preferredTags: [],
  },
};

export const DEFAULT_EMAIL_NOTIFICATION_PREFERENCES: EmailNotificationPreferencesDto = {
  enabled: true,
  frequency: 'daily',
  newDiscussions: true,
  discussionReplies: true,
  newArticles: true,
  favoriteUpdates: true,
  suiteUpdates: true,
  systemAnnouncements: true,
  weeklyDigest: true,
};

export const DEFAULT_IN_APP_NOTIFICATION_PREFERENCES: InAppNotificationPreferencesDto = {
  enabled: true,
  discussionMentions: true,
  discussionReplies: true,
  favoriteUpdates: true,
  systemAlerts: true,
};

export const DEFAULT_PUSH_NOTIFICATION_PREFERENCES: PushNotificationPreferencesDto = {
  enabled: false,
  criticalOnly: true,
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDto = {
  email: DEFAULT_EMAIL_NOTIFICATION_PREFERENCES,
  inApp: DEFAULT_IN_APP_NOTIFICATION_PREFERENCES,
  push: DEFAULT_PUSH_NOTIFICATION_PREFERENCES,
};

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferencesDto = {
  profileVisibility: 'public',
  showEmail: false,
  showBadges: true,
  showActivityHistory: true,
  showFavorites: true,
  showDiscussions: true,
  showSuites: true,
  allowAnalytics: true,
  allowPersonalization: true,
};

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferencesDto = {
  reducedMotion: false,
  highContrast: false,
  fontSize: 'medium',
  screenReaderOptimized: false,
};

export const DEFAULT_CUSTOMER_PREFERENCES: CustomerPreferencesDto = {
  display: DEFAULT_DISPLAY_PREFERENCES,
  content: DEFAULT_CONTENT_PREFERENCES,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  privacy: DEFAULT_PRIVACY_PREFERENCES,
  accessibility: DEFAULT_ACCESSIBILITY_PREFERENCES,
};


