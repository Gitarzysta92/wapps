export interface ChangelogEntry {
  version: string;
  channel: 'stable' | 'prerelease';
  releaseDate: Date;
  description: string;
  type: 'major' | 'minor' | 'patch';
  changes: { type: string; description: string }[];
}

// Local catalog fixtures, newest first. Dates stay fixed across page visits.
export const RELEASES: ChangelogEntry[] = [
  { version: '2.2.0-beta.1', channel: 'prerelease', releaseDate: new Date('2024-01-22T11:30:00Z'),
    description: 'Preview of the next release', type: 'minor',
    changes: [{ type: 'feature', description: 'Preview improvements available for testing' }] },

      {
        version: '2.1.0',
        channel: 'stable',
        releaseDate: new Date('2024-01-15T11:30:00Z'),
        description: 'Major update with new features and improvements',
        type: 'major',
        changes: [
          { type: 'feature', description: 'New user interface improvements' },
          { type: 'feature', description: 'Performance optimizations' },
          { type: 'fix', description: 'Bug fixes and stability improvements' },
          { type: 'feature', description: 'Added dark mode support' },
          { type: 'security', description: 'Enhanced security features' }
        ]
      },
      {
        version: '2.0.3',
        channel: 'stable',
        releaseDate: new Date('2024-01-08T11:30:00Z'),
        description: 'Minor bug fixes and improvements',
        type: 'patch',
        changes: [
          { type: 'fix', description: 'Fixed login issue on mobile devices' },
          { type: 'fix', description: 'Resolved performance regression' }
        ]
      },
      {
        version: '2.0.0',
        channel: 'stable',
        releaseDate: new Date('2023-12-15T11:30:00Z'),
        description: 'Complete redesign with new features',
        type: 'major',
        changes: [
          { type: 'feature', description: 'Complete UI redesign' },
          { type: 'feature', description: 'New dashboard experience' },
          { type: 'feature', description: 'Integration with external services' }
        ]
      }
    ];
