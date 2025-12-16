import { 
  ApplicationDevLogFeedItem, 
  ApplicationTeaserFeedItemDto, 
  ApplicationHealthFeedItemDto, 
  ApplicationReviewFeedItem, 
  ArticleHighlightFeedItem, 
  DiscussionTopicFeedItem, 
  SuiteTeaserFeedItem 
} from "@domains/feed";
import { AttributionType, ContentNature } from "@domains/publication/attribution";
import { CATEGORY_DICTIONARY } from "./categories";
import { TAG_DICTIONARY } from "./tags";


export const FEED_ITEM_EXAMPLES = [

  // Application Teaser Feed Item Example
  {
    id: 'app-teaser-1',
    type: 'application-teaser-feed-item',
    title: 'Quick Task',
    subtitle: 'Discover Quick Task - a powerful application for your needs',
    timestamp: new Date('2024-01-13T14:20:00Z'),
    appSlug: 'quick-task',
    appId: '2',
    appName: 'Quick Task',
    description: 'Discover Quick Task - a powerful application for your needs',
    category: CATEGORY_DICTIONARY.workProductivity,
    tags: [
      TAG_DICTIONARY.blockchain,
      TAG_DICTIONARY.dataScience
    ],
    coverImage: {
      url: 'https://picsum.photos/500',
      alt: 'Quick Task logo'
    },
    aggregatedScore: 4.7,
    reviewsCount: 350,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as ApplicationTeaserFeedItemDto,

  // Application Dev Log Feed Item Example
  {
    id: 'dev-log-1',
    type: 'application-dev-log-feed-item',
    title: 'Photo Snap',
    subtitle: 'Major update with AI-powered features',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    appSlug: 'photo-snap',
    appName: 'Photo Snap',
    version: '2.1.0',
    description: 'Major update introducing AI-powered photo enhancement and batch processing capabilities',
    releaseDate: new Date('2024-01-15T10:30:00Z'),
    changes: [
      { description: 'Added AI-powered photo enhancement', type: 'feature' },
      { description: 'Implemented batch processing', type: 'feature' },
      { description: 'Fixed memory leak in large file processing', type: 'bugfix' },
      { description: 'Improved user interface responsiveness', type: 'improvement' }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HYBRID,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: true,
      generatedBy: 'GPT-4',
    }
  } as ApplicationDevLogFeedItem,



  // Application Health Feed Item Example
  {
    id: 'app-health-1',
    type: 'application-health-feed-item',
    title: 'Photo Snap Health Status',
    subtitle: 'All systems operational',
    timestamp: new Date('2024-01-14T09:15:00Z'),
    appSlug: 'photo-snap',
    appId: '1',
    overallStatus: 'operational',
    statusMessage: 'All systems operational',
    services: [
      {
        name: 'Photo Snap',
        status: 'operational',
        uptime: 99,
        hasInfo: true
      }
    ],
    notices: [
      {
        type: 'info',
        title: 'Service Update',
        message: 'Scheduled maintenance completed',
        timestamp: new Date('2024-01-13T23:00:00Z')
      }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationHealthFeedItemDto,

  // Application Review Feed Item Example
  {
    id: 'app-review-1',
    type: 'application-review-feed-item',
    title: 'Jane Doe reviewed Photo Snap',
    subtitle: 'Absolutely love the new AI features!',
    timestamp: new Date('2024-01-16T16:10:00Z'),
    appSlug: 'photo-snap',
    appId: '1',
    rating: 4.8,
    reviewerName: 'Jane Doe',
    reviewerRole: 'Photographer',
    reviewerAvatar: '',
    testimonial: 'Absolutely love the new AI features! It makes editing photos so much faster and easier.',
    appName: 'Photo Snap',
    reviewDate: '2024-01-16T16:10:00Z',
    helpfulCount: 42,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationReviewFeedItem,

  // Article Highlight Feed Item Example
  {
    id: 'article-highlight-1',
    type: 'article-highlight-feed-item',
    title: 'Boost Your Productivity With Quick Task',
    subtitle: 'Explore top tips to work smarter in 2024.',
    timestamp: new Date('2024-01-10T08:00:00Z'),
    excerpt: 'Explore top tips to work smarter in 2024 and how Quick Task helps you organize your workflow like a pro.',
    author: 'Sarah Novak',
    category: 'Productivity',
    coverImage: {
      url: 'https://picsum.photos/seed/article1/400/200',
      alt: 'Boost Your Productivity With Quick Task'
    },
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.SPONSORED,
      sponsor: 'Quick Task',
      disclosureRequired: true,
    }
  } as ArticleHighlightFeedItem,

  // Discussion Topic Feed Item Example
  {
    id: 'discussion-topic-1',
    type: 'discussion-topic-feed-item',
    title: 'Discussion: Collaboration Tools',
    subtitle: 'Join the conversation about collaboration tools',
    timestamp: new Date('2024-01-11T12:45:00Z'),
    appSlug: 'quick-task',
    topicSlug: 'collaboration-tools',
    discussionData: {
      topic: 'Collaboration Tools',
      messages: [
        {
          id: 1,
          author: 'John Developer',
          content: 'What are your favorite features for collaboration?',
          timestamp: new Date('2024-01-11T12:00:00Z')
        }
      ]
    },
    participantsCount: 12,
    viewsCount: 70,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as DiscussionTopicFeedItem,

];




export const RANDOMIZED_FEED_ITEMS = [
  // Application Dev Log Items (5 items)
  {
    id: 'dev-log-1',
    type: 'application-dev-log-feed-item',
    title: 'Photo Snap',
    subtitle: 'Major update with AI-powered features',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    appSlug: 'photo-snap',
    appName: 'Photo Snap',
    version: '2.1.0',
    description: 'Major update introducing AI-powered photo enhancement and batch processing capabilities',
    releaseDate: new Date('2024-01-15T10:30:00Z'),
    changes: [
      { description: 'Added AI-powered photo enhancement', type: 'feature' },
      { description: 'Implemented batch processing', type: 'feature' },
      { description: 'Fixed memory leak in large file processing', type: 'bugfix' },
      { description: 'Improved user interface responsiveness', type: 'improvement' }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.AI_GENERATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: true,
      generatedBy: 'GPT-4 Turbo',
    }
  } as ApplicationDevLogFeedItem,

  {
    id: 'dev-log-2',
    type: 'application-dev-log-feed-item',
    title: 'Quick Task',
    subtitle: 'Enhanced collaboration features',
    timestamp: new Date('2024-01-12T14:20:00Z'),
    appSlug: 'quick-task',
    appName: 'Quick Task',
    version: '1.8.2',
    description: 'Minor update focusing on team collaboration and real-time synchronization improvements',
    releaseDate: new Date('2024-01-12T14:20:00Z'),
    changes: [
      { description: 'Added real-time team collaboration', type: 'feature' },
      { description: 'Improved task synchronization', type: 'improvement' },
      { description: 'Fixed notification delivery issues', type: 'bugfix' }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.SPONSORED,
      sponsor: 'Quick Task Inc.',
      disclosureRequired: true,
    }
  } as ApplicationDevLogFeedItem,

  {
    id: 'dev-log-3',
    type: 'application-dev-log-feed-item',
    title: 'Speedy VPN',
    subtitle: 'Security enhancements and performance boost',
    timestamp: new Date('2024-01-10T09:15:00Z'),
    appSlug: 'speedy-vpn',
    appName: 'Speedy VPN',
    version: '3.0.1',
    description: 'Major security update with enhanced encryption and improved connection stability',
    releaseDate: new Date('2024-01-10T09:15:00Z'),
    changes: [
      { description: 'Upgraded to AES-256 encryption', type: 'security' },
      { description: 'Added kill switch functionality', type: 'feature' },
      { description: 'Improved connection speed by 40%', type: 'performance' },
      { description: 'Fixed DNS leak vulnerability', type: 'security' }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HYBRID,
      contentNature: ContentNature.PROMOTED,
      disclosureRequired: true,
      generatedBy: 'Claude + Human Review',
    }
  } as ApplicationDevLogFeedItem,

  {
    id: 'dev-log-4',
    type: 'application-dev-log-feed-item',
    title: 'Budget Buddy',
    subtitle: 'New budgeting algorithms and insights',
    timestamp: new Date('2024-01-07T16:45:00Z'),
    appSlug: 'budget-buddy',
    appName: 'Budget Buddy',
    version: '2.3.0',
    description: 'Enhanced budgeting features with AI-powered spending insights and goal tracking',
    releaseDate: new Date('2024-01-07T16:45:00Z'),
    changes: [
      { description: 'Added AI spending insights', type: 'feature' },
      { description: 'Implemented smart goal tracking', type: 'feature' },
      { description: 'Enhanced data visualization', type: 'improvement' },
      { description: 'Fixed sync issues with bank accounts', type: 'bugfix' }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as ApplicationDevLogFeedItem,

  {
    id: 'dev-log-5',
    type: 'application-dev-log-feed-item',
    title: 'Mindful',
    subtitle: 'New meditation programs and sleep tracking',
    timestamp: new Date('2024-01-03T11:30:00Z'),
    appSlug: 'mindful',
    appName: 'Mindful',
    version: '1.5.0',
    description: 'Major wellness update with new meditation programs and advanced sleep tracking features',
    releaseDate: new Date('2024-01-03T11:30:00Z'),
    changes: [
      { description: 'Added 10 new meditation programs', type: 'feature' },
      { description: 'Implemented sleep tracking', type: 'feature' },
      { description: 'Enhanced progress analytics', type: 'improvement' },
      { description: 'Fixed audio playback issues', type: 'bugfix' }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.AI_GENERATED,
      contentNature: ContentNature.ADVERTISEMENT,
      sponsor: 'Wellness Corp',
      disclosureRequired: true,
      generatedBy: 'Marketing AI',
    }
  } as ApplicationDevLogFeedItem,

  // Application Teaser Items (5 items)
  {
    id: 'teaser-1',
    type: 'application-teaser-feed-item',
    title: 'Fit Track',
    subtitle: 'Advanced fitness tracking for athletes',
    timestamp: new Date('2024-01-16T08:00:00Z'),
    appSlug: 'fit-track',
    appId: '5240D028-840D-4344-9B24-6B1DB81071BA',
    appName: 'Fit Track',
    description: 'Professional fitness tracking application with advanced analytics and workout planning',
    category: CATEGORY_DICTIONARY.healthFitness,
    tags: [
      TAG_DICTIONARY.health,
      TAG_DICTIONARY.productivity
    ],
    coverImage: {
      url: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      alt: 'Fit Track logo'
    },
    aggregatedScore: 4.6,
    reviewsCount: 1234,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as ApplicationTeaserFeedItemDto,

  {
    id: 'teaser-2',
    type: 'application-teaser-feed-item',
    title: 'Shop Ease',
    subtitle: 'Complete ecommerce solution for businesses',
    timestamp: new Date('2024-01-14T13:30:00Z'),
    appSlug: 'shop-ease',
    appId: '9E2882B0-2CF4-445E-A7C8-03FF9FFA0FD0',
    appName: 'Shop Ease',
    description: 'Comprehensive ecommerce platform with inventory management and payment processing',
    category: CATEGORY_DICTIONARY.ecommerce,
    tags: [
      TAG_DICTIONARY.ecommerce,
      TAG_DICTIONARY.sales
    ],
    coverImage: {
      url: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      alt: 'Shop Ease logo'
    },
    aggregatedScore: 4.6,
    reviewsCount: 1234, 
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HYBRID,
      contentNature: ContentNature.PROMOTED,
      disclosureRequired: true,
      generatedBy: 'Claude + Editorial Team',
    }
  } as ApplicationTeaserFeedItemDto,

  {
    id: 'teaser-3',
    type: 'application-teaser-feed-item',
    title: 'Photo Snap',
    subtitle: 'AI-powered photo editing made simple',
    timestamp: new Date('2024-01-11T15:45:00Z'),
    appSlug: 'photo-snap',
    appId: '43301C93-54B4-4EC4-80C9-9C169E0768BC',
    appName: 'Photo Snap',
    description: 'Professional photo editing with AI-powered enhancement and batch processing',
    category: CATEGORY_DICTIONARY.photoEditing,
    tags: [
      TAG_DICTIONARY.ai,
      TAG_DICTIONARY.productivity
    ],
    coverImage: {
      url: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      alt: 'Photo Snap logo'
    },
    aggregatedScore: 4.6,
    reviewsCount: 1234,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.AI_GENERATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: true,
      generatedBy: 'GPT-4',
    }
  } as ApplicationTeaserFeedItemDto,

  {
    id: 'teaser-4',
    type: 'application-teaser-feed-item',
    title: 'Quick Task',
    subtitle: 'Team productivity and project management',
    timestamp: new Date('2024-01-09T12:15:00Z'),
    appSlug: 'quick-task',
    appId: '8EEDE19C-22A3-4916-8C44-9F8CC391A7CC',
    appName: 'Quick Task',
    description: 'Streamlined project management with real-time collaboration and task tracking',
    category: CATEGORY_DICTIONARY.projectManagementSoftware,
    tags: [
      TAG_DICTIONARY.productivity,
      TAG_DICTIONARY.web
    ],
    coverImage: {
      url: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      alt: 'Quick Task logo'
    },
    aggregatedScore: 4.6,
    reviewsCount: 1234,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.SPONSORED,
      sponsor: 'Quick Task Inc.',
      disclosureRequired: true,
    }
  } as ApplicationTeaserFeedItemDto,

  {
    id: 'teaser-5',
    type: 'application-teaser-feed-item',
    title: 'Speedy VPN',
    subtitle: 'Secure and fast VPN for all devices',
    timestamp: new Date('2024-01-05T18:20:00Z'),
    appSlug: 'speedy-vpn',
    appId: '65F52175-30CE-412A-8B52-FAD6F7C7D933',
    appName: 'Speedy VPN',
    description: 'High-performance VPN with military-grade encryption and global server network',
    category: CATEGORY_DICTIONARY.engineeringDevelopment,
    tags: [
      TAG_DICTIONARY.security,
      TAG_DICTIONARY.networking
    ],
    coverImage: {
      url: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      alt: 'Speedy VPN logo'
    },
    aggregatedScore: 4.6,
    reviewsCount: 1234,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as ApplicationTeaserFeedItemDto,

  // Application Health Items (5 items)
  {
    id: 'health-1',
    type: 'application-health-feed-item',
    title: 'Photo Snap Health Status',
    subtitle: 'All systems operational with excellent performance',
    timestamp: new Date('2024-01-16T09:00:00Z'),
    appSlug: 'photo-snap',
    appId: '43301C93-54B4-4EC4-80C9-9C169E0768BC',
    overallStatus: 'operational',
    statusMessage: 'All systems are running smoothly with optimal performance metrics.',
    services: [
      {
        name: 'Photo Processing API',
        uptime: 99.9,
        status: 'operational',
        hasInfo: true
      },
      {
        name: 'AI Enhancement Service',
        uptime: 99.8,
        status: 'operational',
        hasInfo: false
      },
      {
        name: 'Storage Service',
        uptime: 100,
        status: 'operational',
        hasInfo: false
      }
    ],
    notices: [],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationHealthFeedItemDto,

  {
    id: 'health-2',
    type: 'application-health-feed-item',
    title: 'Quick Task Health Status',
    subtitle: 'Minor performance degradation observed',
    timestamp: new Date('2024-01-15T11:30:00Z'),
    appSlug: 'quick-task',
    appId: '8EEDE19C-22A3-4916-8C44-9F8CC391A7CC',
    overallStatus: 'degraded',
    statusMessage: 'Some services are experiencing minor performance issues.',
    services: [
      {
        name: 'Task Management API',
        uptime: 98.5,
        status: 'degraded',
        hasInfo: true
      },
      {
        name: 'Real-time Sync',
        uptime: 97.2,
        status: 'degraded',
        hasInfo: true
      },
      {
        name: 'Notification Service',
        uptime: 99.1,
        status: 'operational',
        hasInfo: false
      }
    ],
    notices: [
      {
        type: 'warning',
        title: 'Performance Notice',
        message: 'Response times are slightly elevated due to high load',
        timestamp: new Date('2024-01-16T08:30:00Z')
      }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationHealthFeedItemDto,

  {
    id: 'health-3',
    type: 'application-health-feed-item',
    title: 'Speedy VPN Health Status',
    subtitle: 'Service experiencing issues, investigating',
    timestamp: new Date('2024-01-14T14:15:00Z'),
    appSlug: 'speedy-vpn',
    appId: '65F52175-30CE-412A-8B52-FAD6F7C7D933',
    overallStatus: 'outage',
    statusMessage: 'Critical infrastructure issues detected, emergency response activated.',
    services: [
      {
        name: 'VPN Gateway',
        uptime: 85.2,
        status: 'outage',
        hasInfo: true
      },
      {
        name: 'Authentication Service',
        uptime: 92.1,
        status: 'degraded',
        hasInfo: true
      },
      {
        name: 'DNS Resolution',
        uptime: 88.7,
        status: 'outage',
        hasInfo: true
      }
    ],
    notices: [
      {
        type: 'error',
        title: 'Service Disruption',
        message: 'Critical infrastructure issues detected, emergency response activated',
        timestamp: new Date('2024-01-15T10:00:00Z')
      }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationHealthFeedItemDto,

  {
    id: 'health-4',
    type: 'application-health-feed-item',
    title: 'Budget Buddy Health Status',
    subtitle: 'Service running smoothly with optimal response times',
    timestamp: new Date('2024-01-13T16:45:00Z'),
    appSlug: 'budget-buddy',
    appId: '3AE9FCCA-A167-4DB0-BF86-4FAA9E44C6FC',
    overallStatus: 'operational',
    statusMessage: 'All systems are running smoothly with optimal performance metrics.',
    services: [
      {
        name: 'Budget Analytics API',
        uptime: 99.95,
        status: 'operational',
        hasInfo: false
      },
      {
        name: 'Bank Integration',
        uptime: 99.8,
        status: 'operational',
        hasInfo: false
      },
      {
        name: 'AI Insights Engine',
        uptime: 99.9,
        status: 'operational',
        hasInfo: false
      }
    ],
    notices: [],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationHealthFeedItemDto,

  {
    id: 'health-5',
    type: 'application-health-feed-item',
    title: 'Mindful Health Status',
    subtitle: 'High memory usage detected, monitoring closely',
    timestamp: new Date('2024-01-12T12:20:00Z'),
    appSlug: 'mindful',
    appId: '2952422F-E640-4FBE-8F0A-C9506F6E8CFD',
    overallStatus: 'degraded',
    statusMessage: 'Some services are experiencing minor performance issues.',
    services: [
      {
        name: 'Meditation Streaming',
        uptime: 98.8,
        status: 'degraded',
        hasInfo: true
      },
      {
        name: 'Progress Tracking',
        uptime: 99.2,
        status: 'operational',
        hasInfo: false
      },
      {
        name: 'Sleep Analytics',
        uptime: 97.9,
        status: 'degraded',
        hasInfo: true
      }
    ],
    notices: [
      {
        type: 'info',
        title: 'Maintenance Notice',
        message: 'Scheduled maintenance completed, monitoring system performance',
        timestamp: new Date('2024-01-14T09:00:00Z')
      }
    ],
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationHealthFeedItemDto,

  // Application Review Items (5 items)
  {
    id: 'review-1',
    type: 'application-review-feed-item',
    title: 'John Developer reviewed Photo Snap',
    subtitle: 'This application has transformed our workflow. Highly recommended for teams looking to improve productivity.',
    timestamp: new Date('2024-01-16T10:00:00Z'),
    appSlug: 'photo-snap',
    appId: '43301C93-54B4-4EC4-80C9-9C169E0768BC',
    rating: 5.0,
    reviewerName: 'John Developer',
    reviewerAvatar: '',
    reviewerRole: 'Senior Developer',
    testimonial: 'This application has transformed our workflow. Highly recommended for teams looking to improve productivity.',
    appName: 'Photo Snap',
    reviewDate: '2024-01-16T10:00:00Z',
    helpfulCount: 87,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationReviewFeedItem,

  {
    id: 'review-2',
    type: 'application-review-feed-item',
    title: 'Sarah Engineer reviewed Quick Task',
    subtitle: 'Excellent tool with intuitive interface. The features are exactly what we needed for our project.',
    timestamp: new Date('2024-01-14T15:30:00Z'),
    appSlug: 'quick-task',
    appId: '8EEDE19C-22A3-4916-8C44-9F8CC391A7CC',
    rating: 4.5,
    reviewerName: 'Sarah Engineer',
    reviewerAvatar: '',
    reviewerRole: 'Software Engineer',
    testimonial: 'Excellent tool with intuitive interface. The features are exactly what we needed for our project.',
    appName: 'Quick Task',
    reviewDate: '2024-01-14T15:30:00Z',
    helpfulCount: 124,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationReviewFeedItem,

  {
    id: 'review-3',
    type: 'application-review-feed-item',
    title: 'Mike Tester reviewed Speedy VPN',
    subtitle: 'Outstanding performance and reliability. Our team has been using it for months without any issues.',
    timestamp: new Date('2024-01-11T12:45:00Z'),
    appSlug: 'speedy-vpn',
    appId: '65F52175-30CE-412A-8B52-FAD6F7C7D933',
    rating: 4.8,
    reviewerName: 'Mike Tester',
    reviewerAvatar: '',
    reviewerRole: 'QA Engineer',
    testimonial: 'Outstanding performance and reliability. Our team has been using it for months without any issues.',
    appName: 'Speedy VPN',
    reviewDate: '2024-01-11T12:45:00Z',
    helpfulCount: 156,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationReviewFeedItem,

  {
    id: 'review-4',
    type: 'application-review-feed-item',
    title: 'Emily Architect reviewed Budget Buddy',
    subtitle: 'Great application with solid documentation. Easy to integrate into our existing infrastructure.',
    timestamp: new Date('2024-01-08T09:20:00Z'),
    appSlug: 'budget-buddy',
    appId: '3AE9FCCA-A167-4DB0-BF86-4FAA9E44C6FC',
    rating: 4.3,
    reviewerName: 'Emily Architect',
    reviewerAvatar: '',
    reviewerRole: 'Solution Architect',
    testimonial: 'Great application with solid documentation. Easy to integrate into our existing infrastructure.',
    appName: 'Budget Buddy',
    reviewDate: '2024-01-08T09:20:00Z',
    helpfulCount: 92,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationReviewFeedItem,

  {
    id: 'review-5',
    type: 'application-review-feed-item',
    title: 'David Admin reviewed Mindful',
    subtitle: 'Impressed with the support and regular updates. The development team really cares about user feedback.',
    timestamp: new Date('2024-01-05T16:10:00Z'),
    appSlug: 'mindful',
    appId: '2952422F-E640-4FBE-8F0A-C9506F6E8CFD',
    rating: 4.7,
    reviewerName: 'David Admin',
    reviewerAvatar: '',
    reviewerRole: 'System Administrator',
    testimonial: 'Impressed with the support and regular updates. The development team really cares about user feedback.',
    appName: 'Mindful',
    reviewDate: '2024-01-05T16:10:00Z',
    helpfulCount: 203,
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as ApplicationReviewFeedItem,

  // Article Highlight Items (3 items)
  {
    id: 'article-1',
    type: 'article-highlight-feed-item',
    title: 'Building Scalable Applications with Modern Architecture',
    subtitle: 'Learn how to design applications that can handle millions of users with modern architectural patterns and best practices.',
    timestamp: new Date('2024-01-15T14:00:00Z'),
    excerpt: 'Learn how to design applications that can handle millions of users with modern architectural patterns and best practices.',
    author: 'Tech Editorial Team',
    category: 'Development',
    coverImage: {
      url: 'https://picsum.photos/seed/architecture/400/200',
      alt: 'Building Scalable Applications'
    },
    commentsNumber: 10,
    voting: {
      upvotes: 10,
      downvotes: 3,
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as ArticleHighlightFeedItem,

  {
    id: 'article-2',
    type: 'article-highlight-feed-item',
    title: 'The Future of Web Development: Trends to Watch',
    subtitle: 'Explore the latest trends in web development including AI integration, edge computing, and new frameworks.',
    timestamp: new Date('2024-01-12T11:30:00Z'),
    excerpt: 'Explore the latest trends in web development including AI integration, edge computing, and new frameworks.',
    author: 'Web Development Team',
    category: 'Technology',
    coverImage: {
      url: 'https://picsum.photos/seed/webdev/400/200',
      alt: 'Future of Web Development'
    },
    attribution: {
      attributionType: AttributionType.HYBRID,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: true,
      generatedBy: 'GPT-4 + Human Editorial',
    }
  } as ArticleHighlightFeedItem,

  {
    id: 'article-3',
    type: 'article-highlight-feed-item',
    title: 'Security Best Practices for Modern Applications',
    subtitle: 'Essential security measures every developer should implement to protect user data and prevent vulnerabilities.',
    timestamp: new Date('2024-01-09T16:45:00Z'),
    excerpt: 'Essential security measures every developer should implement to protect user data and prevent vulnerabilities.',
    author: 'Security Team',
    category: 'Security',
    coverImage: {
      url: 'https://picsum.photos/seed/security/400/200',
      alt: 'Security Best Practices'
    },
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as ArticleHighlightFeedItem,

  // Discussion Topic Items (3 items)
  {
    id: 'discussion-1',
    type: 'discussion-topic-feed-item',
    title: 'Discussion: How to optimize application performance?',
    subtitle: 'Join the conversation about how to optimize application performance?',
    timestamp: new Date('2024-01-16T13:00:00Z'),
    appSlug: 'photo-snap',
    topicSlug: 'how-to-optimize-application-performance',
    discussionData: {
      topic: 'How to optimize application performance?',
      messages: [
        {
          id: 1,
          author: 'John Developer',
          content: 'Great question! I think the key is to profile your application first to identify bottlenecks.',
          timestamp: new Date('2024-01-16T13:00:00Z')
        },
        {
          id: 2,
          author: 'Sarah Engineer',
          content: 'I agree with John, and would add that caching strategies can make a huge difference.',
          timestamp: new Date('2024-01-16T13:15:00Z')
        }
      ]
    },
    participantsCount: 23,
    viewsCount: 156,
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as DiscussionTopicFeedItem,

  {
    id: 'discussion-2',
    type: 'discussion-topic-feed-item',
    title: 'Discussion: Best practices for user authentication',
    subtitle: 'Join the conversation about best practices for user authentication',
    timestamp: new Date('2024-01-13T10:30:00Z'),
    appSlug: 'speedy-vpn',
    topicSlug: 'best-practices-for-user-authentication',
    discussionData: {
      topic: 'Best practices for user authentication',
      messages: [
        {
          id: 3,
          author: 'Mike Tester',
          content: 'Multi-factor authentication should be mandatory for sensitive applications.',
          timestamp: new Date('2024-01-13T10:30:00Z')
        },
        {
          id: 4,
          author: 'Emily Architect',
          content: 'OAuth 2.0 and JWT tokens are industry standards that work well together.',
          timestamp: new Date('2024-01-13T10:45:00Z')
        }
      ]
    },
    participantsCount: 18,
    viewsCount: 89,
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as DiscussionTopicFeedItem,

  {
    id: 'discussion-3',
    type: 'discussion-topic-feed-item',
    title: 'Discussion: Database design patterns discussion',
    subtitle: 'Join the conversation about database design patterns discussion',
    timestamp: new Date('2024-01-10T14:20:00Z'),
    appSlug: 'budget-buddy',
    topicSlug: 'database-design-patterns-discussion',
    discussionData: {
      topic: 'Database design patterns discussion',
      messages: [
        {
          id: 5,
          author: 'David Admin',
          content: 'Normalization vs denormalization - it depends on your use case and performance requirements.',
          timestamp: new Date('2024-01-10T14:20:00Z')
        },
        {
          id: 6,
          author: 'Lisa Manager',
          content: 'Consider read/write patterns when designing your schema.',
          timestamp: new Date('2024-01-10T14:35:00Z')
        }
      ]
    },
    participantsCount: 31,
    viewsCount: 203,
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.ORGANIC,
      disclosureRequired: false,
    }
  } as DiscussionTopicFeedItem,

  // Suite Teaser Items (4 items)
  {
    id: 'suite-1',
    type: 'suite-teaser-feed-item',
    title: 'Productivity Suite',
    subtitle: 'Complete productivity tools for modern teams',
    timestamp: new Date('2024-01-14T17:00:00Z'),
    suiteTitle: 'Productivity Suite',
    suiteDescription: 'Complete productivity tools for modern teams',
    apps: [
      { name: 'Task Manager Pro', logo: 'https://picsum.photos/seed/tm/64/64', description: 'Advanced task management' },
      { name: 'Time Tracker', logo: 'https://picsum.photos/seed/tt/64/64', description: 'Time tracking and analytics' },
      { name: 'Team Chat', logo: 'https://picsum.photos/seed/tc/64/64', description: 'Collaborative communication' }
    ],
    category: 'Productivity',
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as SuiteTeaserFeedItem,

  {
    id: 'suite-2',
    type: 'suite-teaser-feed-item',
    title: 'Development Suite',
    subtitle: 'Essential tools for software developers',
    timestamp: new Date('2024-01-11T09:30:00Z'),
    suiteTitle: 'Development Suite',
    suiteDescription: 'Essential tools for software developers',
    apps: [
      { name: 'Code Editor', logo: 'https://picsum.photos/seed/ce/64/64', description: 'Advanced code editing' },
      { name: 'Git Manager', logo: 'https://picsum.photos/seed/gm/64/64', description: 'Git repository management' },
      { name: 'API Tester', logo: 'https://picsum.photos/seed/at/64/64', description: 'API testing and debugging' }
    ],
    category: 'Development',
    attribution: {
      attributionType: AttributionType.HYBRID,
      contentNature: ContentNature.PROMOTED,
      disclosureRequired: true,
      generatedBy: 'Claude AI + Editorial Review',
    }
  } as SuiteTeaserFeedItem,

  {
    id: 'suite-3',
    type: 'suite-teaser-feed-item',
    title: 'Design Suite',
    subtitle: 'Professional design tools for creatives',
    timestamp: new Date('2024-01-08T12:15:00Z'),
    suiteTitle: 'Design Suite',
    suiteDescription: 'Professional design tools for creatives',
    apps: [
      { name: 'Vector Designer', logo: 'https://picsum.photos/seed/vd/64/64', description: 'Vector graphics creation' },
      { name: 'Photo Editor', logo: 'https://picsum.photos/seed/pe/64/64', description: 'Professional photo editing' },
      { name: 'UI Prototyper', logo: 'https://picsum.photos/seed/up/64/64', description: 'Interactive UI prototyping' }
    ],
    category: 'Design',
    attribution: {
      attributionType: AttributionType.AI_GENERATED,
      contentNature: ContentNature.SPONSORED,
      sponsor: 'Design Tools Inc.',
      disclosureRequired: true,
      generatedBy: 'GPT-4',
    }
  } as SuiteTeaserFeedItem,

  {
    id: 'suite-4',
    type: 'suite-teaser-feed-item',
    title: 'Analytics Suite',
    subtitle: 'Data analysis and visualization tools',
    timestamp: new Date('2024-01-05T15:45:00Z'),
    suiteTitle: 'Analytics Suite',
    suiteDescription: 'Data analysis and visualization tools',
    apps: [
      { name: 'Data Explorer', logo: 'https://picsum.photos/seed/de/64/64', description: 'Data exploration and analysis' },
      { name: 'Chart Builder', logo: 'https://picsum.photos/seed/cb/64/64', description: 'Interactive chart creation' },
      { name: 'Report Generator', logo: 'https://picsum.photos/seed/rg/64/64', description: 'Automated report generation' }
    ],
    category: 'Analytics',
    attribution: {
      attributionType: AttributionType.HUMAN_CREATED,
      contentNature: ContentNature.EDITORIAL,
      disclosureRequired: false,
    }
  } as SuiteTeaserFeedItem
];