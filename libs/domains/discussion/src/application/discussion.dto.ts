export type DiscussionPreviewDto = {
  id: string;
  correlationId: unknown;
  slug: string;
  correlationSlug: string;
  title: string;
  author: string;
  authorAvatar: string;
  createdAt: Date;
  repliesCount: number;
  viewsCount: number;
  isPinned: boolean;
  tags: string[];
  excerpt: string;
}



export type DiscussionAuthorDto = {
  id: string;
  slug: string;
  name: string;
  avatar: {
    url: string;
  };
}

export type DiscussionPostDto = {
  id: string;
  content: string;
  author: DiscussionAuthorDto;
  publishedTime: Date;
  upvotesCount: number;
  downvotesCount: number;
  isEdited: boolean;
  editedAt?: Date;
}


export type DiscussionThreadDto = {
  id: string;
  slug: string;
  title: string;
  repliesCount: number;
  viewsCount: number;
  isPinned: boolean;
  tags: { slug: string; name: string }[];
  replies: Array<DiscussionPostDto | DiscussionThreadDto>;
  isRootThread: boolean;
  parentThreadId?: string;
  correlationId: unknown;
} & DiscussionPostDto;


export type DiscussionThreadConfigurationDto = {
  maxDepth: number;
  maxReplies: number;
  maxRepliesPerThread: number;
  maxRepliesPerPost: number;
  maxRepliesPerUser: number;
  maxRepliesPerUserPerPost: number;
  maxRepliesPerUserPerThread: number;
}


export type DiscussionThreadPolicyDto = {
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canUnpin: boolean;
  canLock: boolean;
  canUnlock: boolean;
  canMove: boolean;
  canMerge: boolean;
  canSplit: boolean;
}