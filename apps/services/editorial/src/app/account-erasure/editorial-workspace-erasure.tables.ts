export const editorialWorkspaceFamilies = [
  {
    kind: 'application',
    drafts: 'application_drafts',
    workspace: 'application_workspaces',
    submissions: 'application_submissions',
    parent: 'applicationId',
    commands: [
      ['application_draft_commands', 'draftId', 'ownerIdentityId'],
      ['application_publication_commands', 'applicationId', 'actorIdentityId'],
    ],
    tombstone: "name='',slug='',website='',description=''",
  },
  {
    kind: 'suite',
    drafts: 'private_suites',
    workspace: 'suite_workspaces',
    submissions: 'suite_submissions',
    parent: 'suiteId',
    commands: [
      ['suite_commands', 'suiteId', 'ownerIdentityId'],
      ['suite_publication_commands', 'suiteId', 'actorIdentityId'],
    ],
    tombstone: "title='',description='',applicationIds=JSON_ARRAY()",
  },
  {
    kind: 'article',
    drafts: 'article_drafts',
    workspace: 'article_workspaces',
    submissions: 'article_submissions',
    parent: 'articleId',
    commands: [['article_commands', 'articleId', 'actorIdentityId']],
    tombstone: 'fields=NULL',
  },
  {
    kind: 'release',
    drafts: 'release_drafts',
    workspace: 'release_workspaces',
    submissions: 'release_submissions',
    parent: 'draftId',
    commands: [['release_commands', 'draftId', 'actorIdentityId']],
    tombstone: 'fields=NULL',
  },
] as const;

export type EditorialWorkspaceFamily =
  (typeof editorialWorkspaceFamilies)[number];
export const EDITORIAL_WORKSPACE_ERASURE_BATCH = 128;
