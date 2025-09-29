import { ChangeDetectionStrategy, Component, input, computed, effect, ElementRef, ViewChild, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { trigger, style, transition, animate } from '@angular/animations';

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  isIncoming: boolean;
  senderName?: string;
}

export interface ChatWindowViewModel {
  messages: ChatMessage[];
  currentUser: string;
  otherUser: string;
}

export interface AnimatedChatMessage extends ChatMessage {
  isNew: boolean;
  messageAuthor: string;
}

@Component({
  selector: "ui-chat-window",
  templateUrl: "chat-window.component.html",
  styleUrl: 'chat-window.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
  ],
  animations: [
    trigger('messageSlideIn', [
      transition(':enter', [
        style({ 
          opacity: 0, 
          transform: 'translateY(20px) scale(0.95)' 
        }),
        animate('300ms ease-out', style({ 
          opacity: 1, 
          transform: 'translateY(0) scale(1)' 
        }))
      ])
    ]),
    trigger('typingText', [
      transition(':enter', [
        style({ 
          opacity: 0,
          transform: 'translateX(-10px)'
        }),
        animate('100ms ease-in', style({ 
          opacity: 1,
          transform: 'translateX(0)'
        }))
      ])
    ])
  ]
})
export class ChatWindowComponent implements AfterViewInit {
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  public readonly viewModel = input<ChatWindowViewModel>({
    messages: [],
    currentUser: 'You',
    otherUser: 'Other User'
  });

  public readonly animatedMessages = computed<AnimatedChatMessage[]>(() => {
    const vm = this.viewModel();
    return vm.messages.map((message) => {
      const messageAuthor = !message.isIncoming ? vm.currentUser : (message.senderName || vm.otherUser);
      return {
        ...message,
        isNew: true,
        messageAuthor
      };
    });
  });


  public trackByMessageId(index: number, message: AnimatedChatMessage): string {
    return message.id;
  }

  ngAfterViewInit(): void {
    this.preventUserScrolling();
  }

  private preventUserScrolling(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      
      // Prevent mouse wheel scrolling
      element.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });
      
      // Prevent touch scrolling
      element.addEventListener('touchmove', (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });
      
      // Prevent keyboard scrolling
      element.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
            e.key === 'PageUp' || e.key === 'PageDown' ||
            e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
  }

  public formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  }

  public getCurrentTimestamp(): Date {
    return new Date();
  }
}
