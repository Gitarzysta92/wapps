import { AppRecordDto } from "@domains/catalog/record";
import { AppCompatibilityDto } from '@domains/catalog/compatibility';
import { AppEstimatedUserSpanDto } from "@domains/catalog/metrics";
import { AppOwnershipDto } from "@domains/catalog/ownership";
import { AppMonetizationDto } from "@domains/catalog/pricing";
import { AppReferencesDto } from "@domains/catalog/references";

export const PHOTO_SNAP:
  AppRecordDto &
  AppEstimatedUserSpanDto &
  AppCompatibilityDto &
  AppOwnershipDto &
  AppMonetizationDto &
  AppReferencesDto = {
  id: '43301C93-54B4-4EC4-80C9-9C169E0768BC',
  slug: 'photo-snap',
  name: 'Photo Snap',
  description: 'Professional photo editing and management tool',
  logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=PhotoSnap&backgroundColor=6366f1',
  isPwa: true,
  rating: 4.6,
  tagIds: [71, 11, 12],
  categoryId: 71,
  platformIds: [0, 1],
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2, 3],
  references: [
    {
      id: 1,
      name: 'Photo Snap',
      type: 'photo'
    }
  ],
  monetizations: [
    {
      id: 1,
      name: 'Freemium'
    },
    {
      id: 2,
      name: 'Premium Subscription'
    }
  ],
  owner: {
    id: '1',
    name: 'Photo Snap',
    email: 'photo@snap.com'
  },
  number: 1000000,
}

export const QUICK_TASK: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '8EEDE19C-22A3-4916-8C44-9F8CC391A7CC',
  slug: 'quick-task',
  name: 'Quick Task',
  description: 'Fast and efficient task management for teams',
  logo: 'https://api.dicebear.com/7.x/icons/svg?seed=QuickTask&backgroundColor=10b981',
  isPwa: true,
  rating: 4.6,
  tagIds: [25, 11, 12], // Productivity, Web Development, Mobile Development
  categoryId: 19, // Project management software
  platformIds: [0, 1], // Web, Mobile
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2, 3], // iPhone, Android, Desktop
  references: [
    {
      id: 2,
      name: 'Quick Task',
      type: 'productivity'
    }
  ],
  monetizations: [
    {
      id: 3,
      name: 'Free Plan'
    },
    {
      id: 4,
      name: 'Pro Subscription'
    }
  ],
  owner: {
    id: '2',
    name: 'Quick Task Team',
    email: 'team@quicktask.com'
  },
  number: 500000,
}

const SPEEDY_VPN: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '65F52175-30CE-412A-8B52-FAD6F7C7D933',
  slug: 'speedy-vpn',
  name: 'Speedy VPN',
  description: 'Secure and fast VPN service for all devices',
  logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=SpeedyVPN&backgroundColor=ef4444',
  isPwa: true,
  rating: 4.6,
  tagIds: [8, 9, 11, 12], // Security, Networking, Web Development, Mobile Development
  categoryId: 54, // VPN client
  platformIds: [0, 1, 2], // Web, Mobile, Desktop
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2, 3, 4], // iPhone, Android, Desktop, Tablet
  references: [
    {
      id: 3,
      name: 'Speedy VPN',
      type: 'security'
    }
  ],
  monetizations: [
    {
      id: 5,
      name: 'Monthly Plan'
    },
    {
      id: 6,
      name: 'Annual Plan'
    }
  ],
  owner: {
    id: '3',
    name: 'Speedy VPN Inc',
    email: 'contact@speedyvpn.com'
  },
  number: 2000000,
}

const BUDGET_BUDDY: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '3AE9FCCA-A167-4DB0-BF86-4FAA9E44C6FC',
  slug: 'budget-buddy',
  name: 'Budget Buddy',
  description: 'Smart budgeting and finance tracking app',
  logo: 'https://api.dicebear.com/7.x/icons/svg?seed=BudgetBuddy&backgroundColor=f59e0b',
  isPwa: true,
  rating: 4.6,
  tagIds: [21, 25, 11, 12], // Finance, Productivity, Web Development, Mobile Development
  categoryId: 83, // Budgeting apps
  platformIds: [0, 1], // Web, Mobile
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2], // iPhone, Android
  references: [
    {
      id: 4,
      name: 'Budget Buddy',
      type: 'finance'
    }
  ],
  monetizations: [
    {
      id: 7,
      name: 'Basic Free'
    },
    {
      id: 8,
      name: 'Premium Features'
    }
  ],
  owner: {
    id: '4',
    name: 'Budget Buddy LLC',
    email: 'hello@budgetbuddy.com'
  },
  number: 300000,
}

const MINDFUL: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '2952422F-E640-4FBE-8F0A-C9506F6E8CFD',
  slug: 'mindful',
  name: 'Mindful',
  description: 'Meditation and mindfulness practice companion',
  logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=Mindful&backgroundColor=8b5cf6',
  isPwa: true,
  rating: 4.6,
  tagIds: [23, 25, 11, 12], // Health, Productivity, Web Development, Mobile Development
  categoryId: 153, // Meditation apps
  platformIds: [0, 1], // Web, Mobile
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2, 4], // iPhone, Android, Tablet
  references: [
    {
      id: 5,
      name: 'Mindful',
      type: 'wellness'
    }
  ],
  monetizations: [
    {
      id: 9,
      name: 'Free Meditation'
    },
    {
      id: 10,
      name: 'Premium Wellness'
    }
  ],
  owner: {
    id: '5',
    name: 'Mindful Apps',
    email: 'support@mindful.com'
  },
  number: 800000,
}

const FIT_TRACK: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '5240D028-840D-4344-9B24-6B1DB81071BA',
  slug: 'fit-track',
  name: 'Fit Track',
  description: 'Comprehensive fitness and activity tracking solution',
  logo: 'https://api.dicebear.com/7.x/icons/svg?seed=FitTrack&backgroundColor=06b6d4',
  isPwa: true,
  rating: 4.6,
  tagIds: [23, 25, 11, 12], // Health, Productivity, Web Development, Mobile Development
  categoryId: 148, // Activity tracking
  platformIds: [0, 1], // Web, Mobile
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2, 5], // iPhone, Android, Fitness Tracker
  references: [
    {
      id: 6,
      name: 'Fit Track',
      type: 'fitness'
    }
  ],
  monetizations: [
    {
      id: 11,
      name: 'Basic Tracking'
    },
    {
      id: 12,
      name: 'Pro Fitness'
    }
  ],
  owner: {
    id: '6',
    name: 'Fit Track Solutions',
    email: 'info@fittrack.com'
  },
  number: 600000,
}

const SHOP_EASE: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '9E2882B0-2CF4-445E-A7C8-03FF9FFA0FD0',
  slug: 'shop-ease',
  name: 'Shop Ease',
  description: 'Easy and intuitive ecommerce platform',
  logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=ShopEase&backgroundColor=ec4899',
  isPwa: true,
  rating: 4.6,
  tagIds: [18, 21, 11, 12], // Ecommerce, Finance, Web Development, Mobile Development
  categoryId: 178, // Ecommerce platforms
  platformIds: [0, 1], // Web, Mobile
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2, 3], // iPhone, Android, Desktop
  references: [
    {
      id: 7,
      name: 'Shop Ease',
      type: 'ecommerce'
    }
  ],
  monetizations: [
    {
      id: 13,
      name: 'Starter Plan'
    },
    {
      id: 14,
      name: 'Business Plan'
    },
    {
      id: 15,
      name: 'Enterprise Plan'
    }
  ],
  owner: {
    id: '7',
    name: 'Shop Ease Corp',
    email: 'contact@shopease.com'
  },
  number: 1500000,
}

export const APPLICATIONS = [
  PHOTO_SNAP,
  QUICK_TASK,
  SPEEDY_VPN,
  BUDGET_BUDDY,
  MINDFUL,
  FIT_TRACK,
  SHOP_EASE,
]