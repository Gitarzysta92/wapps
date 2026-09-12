import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SHARING_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';
import { SharingApiService } from './sharing-api.service';

describe('SharingApiService', () => {
  let navigator: { share?: jest.Mock; clipboard?: { writeText: jest.Mock } };
  let service: SharingApiService;
  beforeEach(() => {
    navigator = {};
    TestBed.configureTestingModule({ providers: [SharingApiService,
      { provide: SHARING_BASE_URL_PROVIDER, useValue: 'https://api.sharing.com' },
      { provide: DOCUMENT, useValue: { baseURI: 'https://portal.example/', defaultView: { location: { origin: 'https://portal.example' }, navigator } } },
    ] });
    service = TestBed.inject(SharingApiService);
  });
  it('uses the portal origin and correct apps route, with escaped slugs', () => {
    expect(service.contentUrl('applications', 'photo snap')).toBe('https://portal.example/apps/photo%20snap');
    expect(service.contentUrl('discussions', 'topic', '/apps/photo-snap/discussions/topic')).toBe('https://portal.example/apps/photo-snap/discussions/topic');
    expect(() => service.contentUrl('articles', 'x', 'javascript:alert(1)')).toThrow();
    expect(() => service.contentUrl('articles', 'x', 'https://another.example')).toThrow();
  });
  it('copies the correct suite link when native sharing is unavailable', async () => {
    navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
    expect(await firstValueFrom(service.shareContent('suites', 'design-suite', 'Design suite'))).toEqual({ ok: true, value: true });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://portal.example/suites/design-suite');
  });
  it('distinguishes cancellation from completion', async () => {
    navigator.share = jest.fn().mockRejectedValue(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
    expect(await firstValueFrom(service.shareContent('articles', 'design', 'Design'))).toEqual({ ok: true, value: false });
  });
  it('returns a recoverable error when clipboard is missing, rejected, or throws synchronously', async () => {
    expect(service.canShare()).toBe(false);
    expect((await firstValueFrom(service.shareContent('articles', 'design', 'Design'))).ok).toBe(false);
    navigator.clipboard = { writeText: jest.fn().mockRejectedValue(new Error('Denied')) };
    expect((await firstValueFrom(service.shareContent('articles', 'design', 'Design'))).ok).toBe(false);
    navigator.share = jest.fn(() => { throw new Error('Unavailable'); });
    expect((await firstValueFrom(service.shareContent('articles', 'design', 'Design'))).ok).toBe(false);
  });
});
