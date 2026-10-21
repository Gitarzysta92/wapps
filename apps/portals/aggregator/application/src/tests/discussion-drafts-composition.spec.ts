import { TestBed } from '@angular/core/testing';
import {
  LocalDiscussionDraftsService,
  provideApplicationOverviewFeature,
  provideDemoDiscussionDrafts,
} from '@portals/shared/features/application-overview';

describe('explicit demo discussion composition', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not read browser content or supply sample threads by default', () => {
    const read = jest.spyOn(Storage.prototype, 'getItem');
    const drafts = TestBed.inject(LocalDiscussionDraftsService);
    expect(drafts.threads('photo-snap')).toEqual([]);
    expect(drafts.previews('photo-snap')).toEqual([]);
    expect(() => drafts.create('photo-snap', 'Title', 'Body')).toThrow(
      'explicit demo mode'
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('provides browser draft access only through explicit demo composition', () => {
    TestBed.configureTestingModule({
      providers: provideApplicationOverviewFeature({ useBff: false }).providers,
    });
    expect(
      TestBed.inject(LocalDiscussionDraftsService).threads('photo-snap').length
    ).toBeGreaterThan(0);
  });

  it('real API composition overrides any earlier demo provider', () => {
    TestBed.configureTestingModule({
      providers: [
        ...provideDemoDiscussionDrafts(),
        ...provideApplicationOverviewFeature({ useBff: true }).providers,
      ],
    });
    const drafts = TestBed.inject(LocalDiscussionDraftsService);
    expect(drafts.threads('photo-snap')).toEqual([]);
    expect(() => drafts.reply('photo-snap', 'topic', 'Body')).toThrow(
      'explicit demo mode'
    );
  });
});
