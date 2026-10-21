import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { ok } from '@sdk/kernel/standard';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { MENTION_MEMBERS } from '../../application/mention-members.port';
import { MentionMemberPickerComponent } from './mention-member-picker.component';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
describe('explicit mention picker', () => {
  it('retains hidden references for editing, bounds unique selections, and respects a pending post', () => {
    TestBed.configureTestingModule({
      imports: [MentionMemberPickerComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: {
            token$: new BehaviorSubject('author'),
            getToken: () => 'author',
          },
        },
        {
          provide: MENTION_MEMBERS,
          useValue: {
            read: () => of(ok(null)),
            directory: () => of(ok({ items: [], after: null })),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MentionMemberPickerComponent);
    fixture.componentRef.setInput('selected', [id(1)]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unavailable member');
    const picker = fixture.componentInstance;
    picker.add(id(1));
    expect(picker.selected()).toEqual([id(1)]);
    for (let n = 2; n <= 11; n++) picker.add(id(n));
    expect(picker.selected()).toHaveLength(10);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    picker.remove(id(1));
    expect(picker.selected()).toHaveLength(10);
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
    picker.remove(id(1));
    expect(picker.selected()).not.toContain(id(1));
  });
});
