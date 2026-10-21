import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatInputComponent } from './chat-input.component';

@Component({
  imports: [ChatInputComponent],
  template: `<lib-chat-input
    [disabled]="disabled"
    (submitted)="messages.push($event)"
    (contentChanged)="changes.push($event)"
    (focusChanged)="focus.push($event)"
  />`,
})
class ChatInputHostComponent {
  disabled = false;
  messages: string[] = [];
  changes: string[] = [];
  focus: boolean[] = [];
}

describe('ChatInputComponent', () => {
  let component: ChatInputComponent;
  let fixture: ComponentFixture<ChatInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('delivers content, focus and submission through the public bindings', fakeAsync(() => {
    const host = TestBed.createComponent(ChatInputHostComponent);
    host.detectChanges();
    const input: HTMLDivElement = host.nativeElement.querySelector('[role="textbox"]');
    input.dispatchEvent(new FocusEvent('focus'));
    input.textContent = '  Search for a tool  ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(host.componentInstance.messages).toEqual([]);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(host.componentInstance.messages).toEqual(['Search for a tool']);
    expect(host.componentInstance.changes).toEqual(['  Search for a tool  ', '']);
    expect(host.componentInstance.focus).toEqual([true]);
    expect(input.textContent).toBe('');
    tick(100);
  }));

  it('does not submit disabled input or whitespace-only content', () => {
    const host = TestBed.createComponent(ChatInputHostComponent);
    host.componentInstance.disabled = true;
    host.detectChanges();
    const input: HTMLDivElement = host.nativeElement.querySelector('[role="textbox"]');
    input.textContent = 'Search';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(host.componentInstance.messages).toEqual([]);
    host.componentInstance.disabled = false;
    host.detectChanges();
    input.textContent = '   ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(host.componentInstance.messages).toEqual([]);
  });
});
