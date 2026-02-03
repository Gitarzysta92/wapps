import type { DiscussionThreadDto } from '@domains/discussion';
import { APPLICATIONS } from './applications';

export const SAMPLE_DISCUSSION: DiscussionThreadDto = {
  id: 'thread-1',
  associationId: APPLICATIONS[0].id,
  slug: 'how-to-integrate-with-external-apis',
  title: 'How to integrate with external APIs?',
  content: `I'm trying to integrate this app with our existing API infrastructure but running into authentication issues. The documentation mentions OAuth 2.0 support, but I'm not sure how to properly configure the client credentials.

Has anyone successfully integrated this with a REST API? I'd love to see some examples or get guidance on the best practices for handling authentication tokens.

My current setup is using Node.js with Express, and I'm getting 401 errors when trying to make authenticated requests. Any help would be greatly appreciated!`,
  author: {
    id: 'user-1',
    slug: 'sarah-chen',
    name: 'Sarah Chen',
    avatar: { url: 'https://i.pravatar.cc/40?img=1' }
  },
  publishedTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
  upvotesCount: 8,
  downvotesCount: 0,
  isEdited: false,
  repliesCount: 12,
  viewsCount: 156,
  isPinned: true,
  isRootThread: true,
  tags: [
    { slug: 'integration', name: 'Integration' },
    { slug: 'api', name: 'API' },
    { slug: 'help', name: 'Help' }
  ],
  replies: [
    {
      id: 'reply-1',
      content: `I had the same issue! The key is to make sure you're including the Authorization header with "Bearer " prefix. Here's what worked for me:

\`\`\`javascript
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});
\`\`\``,
      author: {
        id: 'user-2',
        slug: 'mike-johnson',
        name: 'Mike Johnson',
        avatar: { url: 'https://i.pravatar.cc/40?img=2' }
      },
      publishedTime: new Date(Date.now() - 1000 * 60 * 60),
      upvotesCount: 5,
      downvotesCount: 0,
      isEdited: false
    },
    {
      id: 'reply-2',
      content: `Make sure you're also checking the token expiration. I was getting 401s because my tokens were expiring every hour. The API returns a refresh token that you can use to get new access tokens.`,
      author: {
        id: 'user-3',
        slug: 'emma-wilson',
        name: 'Emma Wilson',
        avatar: { url: 'https://i.pravatar.cc/40?img=3' }
      },
      publishedTime: new Date(Date.now() - 1000 * 60 * 45),
      upvotesCount: 3,
      downvotesCount: 0,
      isEdited: false
    }
  ]
};

export const OAUTH_DISCUSSION: DiscussionThreadDto = {
  id: 'thread-2',
  associationId: APPLICATIONS[0].id,
  slug: 'oauth-implementation',
  title: 'OAuth Implementation Best Practices',
  content: `What are the recommended best practices for implementing OAuth 2.0 in a web application? I want to make sure I'm following security guidelines properly.`,
  author: {
    id: 'user-4',
    slug: 'alex-turner',
    name: 'Alex Turner',
    avatar: { url: 'https://i.pravatar.cc/40?img=4' }
  },
  publishedTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
  upvotesCount: 12,
  downvotesCount: 0,
  isEdited: false,
  repliesCount: 8,
  viewsCount: 89,
  isPinned: false,
  isRootThread: true,
  tags: [
    { slug: 'oauth', name: 'OAuth' },
    { slug: 'security', name: 'Security' },
    { slug: 'authentication', name: 'Authentication' }
  ],
  replies: []
};

export const RATE_LIMITING_DISCUSSION: DiscussionThreadDto = {
  id: 'thread-3',
  associationId: APPLICATIONS[0].id,
  slug: 'api-rate-limiting',
  title: 'API Rate Limiting Strategies',
  content: `Has anyone implemented rate limiting for their API? What strategies work best for handling burst traffic while protecting the backend?`,
  author: {
    id: 'user-5',
    slug: 'jordan-lee',
    name: 'Jordan Lee',
    avatar: { url: 'https://i.pravatar.cc/40?img=5' }
  },
  publishedTime: new Date(Date.now() - 1000 * 60 * 60 * 48),
  upvotesCount: 6,
  downvotesCount: 0,
  isEdited: false,
  repliesCount: 5,
  viewsCount: 67,
  isPinned: false,
  isRootThread: true,
  tags: [
    { slug: 'api', name: 'API' },
    { slug: 'rate-limiting', name: 'Rate Limiting' },
    { slug: 'performance', name: 'Performance' }
  ],
  replies: []
};

export const DISCUSSIONS: DiscussionThreadDto[] = [
  SAMPLE_DISCUSSION,
  OAUTH_DISCUSSION,
  RATE_LIMITING_DISCUSSION
];
