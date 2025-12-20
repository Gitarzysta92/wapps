import { type DiscussionPostVM } from '@ui/discussion';

export interface DiscussionTopicDto {
  id: string;
  slug: string;
  title: string;
  repliesCount: number;
  viewsCount: number;
  isPinned: boolean;
  tags: string[];
  openingPost: DiscussionPostVM;
  replies: DiscussionPostVM[];
}

export const SAMPLE_DISCUSSION: DiscussionTopicDto = {
  id: '1',
  slug: 'how-to-integrate-with-external-apis',
  title: 'How to integrate with external APIs?',
  repliesCount: 12,
  viewsCount: 156,
  isPinned: true,
  tags: ['integration', 'api', 'help'],
  openingPost: {
    id: '1',
    content: `I'm trying to integrate this app with our existing API infrastructure but running into authentication issues. The documentation mentions OAuth 2.0 support, but I'm not sure how to properly configure the client credentials.

Has anyone successfully integrated this with a REST API? I'd love to see some examples or get guidance on the best practices for handling authentication tokens.

My current setup is using Node.js with Express, and I'm getting 401 errors when trying to make authenticated requests. Any help would be greatly appreciated!`,
    author: {
      name: 'Sarah Chen',
      avatar: {
        url: 'https://i.pravatar.cc/40?img=1'
      }
    },
    publishedTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
    engagement: {
      likes: 8
    }
  },
  replies: [
    {
      id: '2',
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
        name: 'Mike Johnson',
        avatar: {
          url: 'https://i.pravatar.cc/40?img=2'
        }
      },
      publishedTime: new Date(Date.now() - 1000 * 60 * 60),
      engagement: {
        likes: 5
      }
    },
    {
      id: '3',
      content: `Make sure you're also checking the token expiration. I was getting 401s because my tokens were expiring every hour. The API returns a refresh token that you can use to get new access tokens.`,
      author: {
        name: 'Emma Wilson',
        avatar: {
          url: 'https://i.pravatar.cc/40?img=3'
        }
      },
      publishedTime: new Date(Date.now() - 1000 * 60 * 45),
      engagement: {
        likes: 3
      }
    }
  ]
};

export const OAUTH_DISCUSSION: DiscussionTopicDto = {
  id: '2',
  slug: 'oauth-implementation',
  title: 'OAuth Implementation Best Practices',
  repliesCount: 8,
  viewsCount: 89,
  isPinned: false,
  tags: ['oauth', 'security', 'authentication'],
  openingPost: {
    id: '4',
    content: `What are the recommended best practices for implementing OAuth 2.0 in a web application? I want to make sure I'm following security guidelines properly.`,
    author: {
      name: 'Alex Turner',
      avatar: {
        url: 'https://i.pravatar.cc/40?img=4'
      }
    },
    publishedTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
    engagement: {
      likes: 12
    }
  },
  replies: []
};

export const RATE_LIMITING_DISCUSSION: DiscussionTopicDto = {
  id: '3',
  slug: 'api-rate-limiting',
  title: 'API Rate Limiting Strategies',
  repliesCount: 5,
  viewsCount: 67,
  isPinned: false,
  tags: ['api', 'rate-limiting', 'performance'],
  openingPost: {
    id: '5',
    content: `Has anyone implemented rate limiting for their API? What strategies work best for handling burst traffic while protecting the backend?`,
    author: {
      name: 'Jordan Lee',
      avatar: {
        url: 'https://i.pravatar.cc/40?img=5'
      }
    },
    publishedTime: new Date(Date.now() - 1000 * 60 * 60 * 48),
    engagement: {
      likes: 6
    }
  },
  replies: []
};

export const DISCUSSIONS: DiscussionTopicDto[] = [
  SAMPLE_DISCUSSION,
  OAUTH_DISCUSSION,
  RATE_LIMITING_DISCUSSION
];
