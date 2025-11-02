// Static data for feed item generation

export const ARTICLES_DATA = [
  {
    title: 'Building Scalable Applications with Modern Architecture',
    excerpt: 'Learn how to design applications that can handle millions of users with modern architectural patterns and best practices.',
    author: 'Tech Editorial Team',
    category: 'Development'
  },
  {
    title: 'The Future of Web Development: Trends to Watch',
    excerpt: 'Explore the latest trends in web development including AI integration, edge computing, and new frameworks.',
    author: 'Web Development Team',
    category: 'Technology'
  },
  {
    title: 'Security Best Practices for Modern Applications',
    excerpt: 'Essential security measures every developer should implement to protect user data and prevent vulnerabilities.',
    author: 'Security Team',
    category: 'Security'
  },
  {
    title: 'Microservices vs Monoliths: Choosing the Right Architecture',
    excerpt: 'A comprehensive guide to help you decide between microservices and monolithic architectures for your next project.',
    author: 'Architecture Team',
    category: 'Architecture'
  },
  {
    title: 'DevOps Best Practices for Continuous Deployment',
    excerpt: 'Learn how to implement effective DevOps practices to streamline your deployment pipeline and improve reliability.',
    author: 'DevOps Team',
    category: 'DevOps'
  }
];

export const DISCUSSION_TOPICS_DATA = [
  'How to optimize application performance?',
  'Best practices for user authentication',
  'Database design patterns discussion',
  'API versioning strategies',
  'Testing methodologies for large applications',
  'Code review best practices',
  'Handling large-scale data processing',
  'Mobile app development trends',
  'Cloud infrastructure optimization',
  'User experience design principles'
];

export const SUITES_DATA = [
  {
    title: 'Productivity Suite',
    description: 'Complete productivity tools for modern teams',
    category: 'Productivity',
    apps: [
      { name: 'Task Manager Pro', logo: 'https://picsum.photos/seed/tm/64/64', description: 'Advanced task management' },
      { name: 'Time Tracker', logo: 'https://picsum.photos/seed/tt/64/64', description: 'Time tracking and analytics' },
      { name: 'Team Chat', logo: 'https://picsum.photos/seed/tc/64/64', description: 'Collaborative communication' }
    ]
  },
  {
    title: 'Development Suite',
    description: 'Essential tools for software developers',
    category: 'Development',
    apps: [
      { name: 'Code Editor', logo: 'https://picsum.photos/seed/ce/64/64', description: 'Advanced code editing' },
      { name: 'Git Manager', logo: 'https://picsum.photos/seed/gm/64/64', description: 'Git repository management' },
      { name: 'API Tester', logo: 'https://picsum.photos/seed/at/64/64', description: 'API testing and debugging' }
    ]
  },
  {
    title: 'Design Suite',
    description: 'Professional design tools for creatives',
    category: 'Design',
    apps: [
      { name: 'Vector Designer', logo: 'https://picsum.photos/seed/vd/64/64', description: 'Vector graphics creation' },
      { name: 'Photo Editor', logo: 'https://picsum.photos/seed/pe/64/64', description: 'Professional photo editing' },
      { name: 'UI Prototyper', logo: 'https://picsum.photos/seed/up/64/64', description: 'Interactive UI prototyping' }
    ]
  },
  {
    title: 'Analytics Suite',
    description: 'Data analysis and visualization tools',
    category: 'Analytics',
    apps: [
      { name: 'Data Explorer', logo: 'https://picsum.photos/seed/de/64/64', description: 'Data exploration and analysis' },
      { name: 'Chart Builder', logo: 'https://picsum.photos/seed/cb/64/64', description: 'Interactive chart creation' },
      { name: 'Report Generator', logo: 'https://picsum.photos/seed/rg/64/64', description: 'Automated report generation' }
    ]
  }
];

export const REVIEWER_NAMES_DATA = [
  'John Developer',
  'Sarah Engineer',
  'Mike Tester',
  'Emily Architect',
  'David Admin',
  'Lisa Manager',
  'Tom Designer',
  'Anna Analyst',
  'Chris Consultant',
  'Maria Specialist',
  'Alex Expert',
  'Jordan Professional'
];

export const REVIEWER_ROLES_DATA = [
  'Developer',
  'Software Engineer',
  'QA Tester',
  'Solutions Architect',
  'System Administrator',
  'Project Manager',
  'UI/UX Designer',
  'Data Analyst',
  'DevOps Engineer',
  'Product Manager',
  'Technical Lead',
  'Security Specialist'
];

export const TESTIMONIALS_DATA = [
  'This application has transformed our workflow. Highly recommended for teams looking to improve productivity.',
  'Excellent tool with intuitive interface. The features are exactly what we needed for our project.',
  'Outstanding performance and reliability. Our team has been using it for months without any issues.',
  'Great application with solid documentation. Easy to integrate into our existing infrastructure.',
  'Impressed with the support and regular updates. The development team really cares about user feedback.',
  'Best solution in its category. The features are comprehensive and well-thought-out.',
  'Game-changer for our development process. Saved us countless hours of manual work.',
  'Reliable and efficient. The application delivers exactly what it promises without bloat.',
  'The learning curve was minimal, and the results were immediate. Perfect for our use case.',
  'Outstanding customer support and regular feature updates. This tool has become essential to our workflow.',
  'Clean interface and powerful features. It has significantly improved our team\'s efficiency.',
  'The best investment we\'ve made for our development process. Highly recommend to other teams.'
];

export const HEALTH_STATUS_MESSAGES_DATA = {
  operational: [
    'All systems operational with excellent performance',
    'Service running smoothly with optimal response times',
    'No issues detected, all metrics within normal range',
    'System health is excellent, uptime at 99.9%',
    'All services running optimally with fast response times',
    'System performance is outstanding, no issues reported'
  ],
  degraded: [
    'High memory usage detected, monitoring closely',
    'Response times slightly elevated, investigating',
    'Minor performance degradation observed',
    'Increased error rate detected, monitoring situation',
    'Some services experiencing slower response times',
    'Performance metrics showing slight deviation from normal'
  ],
  outage: [
    'Service experiencing issues, investigating',
    'Critical error detected, immediate attention required',
    'Service unavailable, emergency response activated',
    'System failure detected, recovery in progress',
    'Major service disruption, working on resolution',
    'Critical system failure, emergency procedures initiated'
  ]
};
