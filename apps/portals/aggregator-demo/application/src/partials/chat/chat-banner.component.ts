import { Component, signal, Input, Output, EventEmitter, OnChanges, SimpleChanges, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatWindowComponent, ChatMessage, ChatWindowViewModel } from '@ui/chat';

@Component({
  selector: 'chat-banner',
  templateUrl: 'chat-banner.component.html',
  styleUrl: 'chat-banner.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    ChatWindowComponent
  ]
})
export class ChatBannerComponent implements OnInit, OnChanges {
  @Input() isCollapsed = false;
  @Input() height = 200;
  @Output() stickyStateChange = new EventEmitter<{isSticky: boolean, height: number}>();

  // All messages to be displayed
  private readonly allMessages: ChatMessage[] = [
    {
      id: '1',
      text: 'Welcome! How can I help you find what you\'re looking for?',
      timestamp: new Date(),
      isIncoming: true,
      senderName: 'Assistant'
    },
    {
      id: '2',
      text: 'I\'m looking for some great apps to try out.',
      timestamp: new Date(),
      isIncoming: false
    },
    {
      id: '3',
      text: 'Great! I can help you discover amazing applications. What type of apps are you interested in?',
      timestamp: new Date(),
      isIncoming: true,
      senderName: 'Assistant'
    }
  ];

  // Currently displayed messages (starts empty)
  public readonly chatMessages = signal<ChatMessage[]>([]);

  // ViewModel for chat window
  public readonly chatViewModel = computed<ChatWindowViewModel>(() => ({
    messages: this.chatMessages(),
    currentUser: 'You',
    otherUser: 'Assistant'
  }));

  ngOnInit(): void {
    this.addMessagesProgressively();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isCollapsed'] || changes['height']) {
      this.emitStickyState();
    }
  }

  private addMessagesProgressively(): void {
    this.allMessages.forEach((message, index) => {
      setTimeout(() => {
        // Update timestamp to current time when adding
        const messageWithCurrentTime = {
          ...message,
          timestamp: new Date()
        };
        
        this.chatMessages.update(messages => [...messages, messageWithCurrentTime]);
      }, index * 2000); // 2 seconds between each message
    });
  }

  private emitStickyState(): void {
    this.stickyStateChange.emit({
      isSticky: !this.isCollapsed,
      height: this.isCollapsed ? 0 : this.height
    });
  }
}
