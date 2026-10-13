import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { ok, err, type Result } from '@sdk/kernel/standard';
import { APPLICATION_MEDIA } from './application/application-media.port';
import { APPLICATION_WORKSPACE_SESSION } from './application/application-drafts.port';
import { ApplicationImagePreviewComponent } from './presentation/application-image-preview.component';

describe('private application image preview lifetime', () => {
  const reference = {
    kind: 'upload',
    asset: {
      id: '019a0010-0000-7000-8000-000000000002',
      purpose: 'logo',
      contentType: 'image/webp',
      width: 1,
      height: 1,
      bytes: 1,
      sha256: 'a'.repeat(64),
    },
  };
  let session: BehaviorSubject<string | null>;
  let response: Subject<Result<Blob, Error>>;
  const create = jest.fn();
  const revoke = jest.fn();
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    response = new Subject();
    create.mockReset().mockReturnValue('blob:private-preview');
    revoke.mockReset();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: create },
      revokeObjectURL: { configurable: true, value: revoke },
    });
    TestBed.configureTestingModule({
      imports: [ApplicationImagePreviewComponent],
      providers: [
        { provide: APPLICATION_MEDIA, useValue: { preview: () => response } },
        { provide: APPLICATION_WORKSPACE_SESSION, useValue: { key$: session } },
      ],
    });
  });
  function preview() {
    const fixture = TestBed.createComponent(ApplicationImagePreviewComponent);
    fixture.componentRef.setInput('reference', reference);
    fixture.componentRef.setInput('target', {
      kind: 'upload',
      id: reference.asset.id,
    });
    fixture.detectChanges();
    return fixture;
  }
  it('revokes loaded bytes on account switch and ignores late emissions', () => {
    const fixture = preview();
    response.next(ok(new Blob(['a'])));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
    session.next(null);
    fixture.detectChanges();
    expect(revoke).toHaveBeenCalledWith('blob:private-preview');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    response.next(ok(new Blob(['late'])));
    expect(create).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Sign in');
  });
  it('cancels the previous read when the immutable reference changes', () => {
    const fixture = preview();
    const obsolete = response;
    response = new Subject();
    fixture.componentRef.setInput('reference', {
      ...reference,
      asset: { ...reference.asset, sha256: 'b'.repeat(64) },
    });
    fixture.detectChanges();
    obsolete.next(ok(new Blob(['old'])));
    expect(create).not.toHaveBeenCalled();
    response.next(ok(new Blob(['new'])));
    fixture.destroy();
    expect(revoke).toHaveBeenCalledTimes(1);
  });
  it('displays unavailable reads truthfully and releases bytes when image decoding fails', () => {
    const fixture = preview();
    response.next(err(new Error('reference changed')));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('reference changed');
    expect(create).not.toHaveBeenCalled();
    fixture.componentInstance.retry.update((value) => value + 1);
    fixture.detectChanges();
    response.next(ok(new Blob(['a'])));
    fixture.componentInstance.failedImage();
    fixture.detectChanges();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    fixture.destroy();
    expect(revoke).toHaveBeenCalledTimes(1);
  });
  it('keeps legacy references as deliberate external links without fetching them', () => {
    const fixture = preview();
    fixture.componentRef.setInput('reference', {
      kind: 'external',
      url: 'https://example.test/image.png',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('a').getAttribute('referrerpolicy')
    ).toBe('no-referrer');
    response.next(ok(new Blob(['late'])));
    expect(create).not.toHaveBeenCalled();
  });
});
