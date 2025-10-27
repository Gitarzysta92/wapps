import { AppRecordDto } from "@domains/catalog/record";
import { AppCompatibilityDto } from '@domains/catalog/compatibility';
import { AppEstimatedUserSpanDto } from "@domains/catalog/metrics";
import { AppOwnershipDto } from "@domains/catalog/ownership";
import { AppMonetizationDto } from "@domains/catalog/pricing";
import { AppReferencesDto } from "@domains/catalog/references";

const PHOTO_SNAP:
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
  logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
  isPwa: true,
  rating: 4.6,
  tagIds: [71, 11, 12], // Photo editing, Web Development, Mobile Development
  categoryId: 71, // Photo editing
  platformIds: [0, 1], // Web, Mobile
  reviewNumber: 1234,
  updateDate: new Date(),
  listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  deviceIds: [1, 2, 3], // iPhone, Android, Desktop
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
}

const QUICK_TASK: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '8EEDE19C-22A3-4916-8C44-9F8CC391A7CC',
  slug: 'quick-task',
  name: 'Quick Task',
  description: 'Fast and efficient task management for teams',
  logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
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
  }
}

const SPEEDY_VPN: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '65F52175-30CE-412A-8B52-FAD6F7C7D933',
  slug: 'speedy-vpn',
  name: 'Speedy VPN',
  description: 'Secure and fast VPN service for all devices',
  logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
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
  }
}

const BUDGET_BUDDY: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '3AE9FCCA-A167-4DB0-BF86-4FAA9E44C6FC',
  slug: 'budget-buddy',
  name: 'Budget Buddy',
  description: 'Smart budgeting and finance tracking app',
  logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
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
  }
}

const MINDFUL: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '2952422F-E640-4FBE-8F0A-C9506F6E8CFD',
  slug: 'mindful',
  name: 'Mindful',
  description: 'Meditation and mindfulness practice companion',
  logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
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
  }
}

const FIT_TRACK: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '5240D028-840D-4344-9B24-6B1DB81071BA',
  slug: 'fit-track',
  name: 'Fit Track',
  description: 'Comprehensive fitness and activity tracking solution',
  logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
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
  }
}

const SHOP_EASE: AppRecordDto & AppEstimatedUserSpanDto & AppCompatibilityDto & AppOwnershipDto & AppMonetizationDto & AppReferencesDto = {
  id: '9E2882B0-2CF4-445E-A7C8-03FF9FFA0FD0',
  slug: 'shop-ease',
  name: 'Shop Ease',
  description: 'Easy and intuitive ecommerce platform',
  logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
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
  }
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