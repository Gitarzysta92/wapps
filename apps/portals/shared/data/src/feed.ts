import { ApplicationDevLogFeedItem } from "@domains/feed";

export const feed = [
  {
    id: '1',
    type: 'application-dev-log',
    title: 'Application Dev Log',
    subtitle: 'Application Dev Log',
    timestamp: new Date(),
    appSlug: 'application-slug',
    appName: 'application-name',
    version: '1.0.0',
    description: 'Application Dev Log',
    releaseDate: new Date(),
    changes: [{
      description: "Added new feature",
      type: "feature"
    }],
    changeType: 'major',
  } as ApplicationDevLogFeedItem,
]