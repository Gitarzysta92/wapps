import { Component, signal, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatWindowComponent, ChatMessage } from '@ui/chat';

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
export class ChatBannerComponent implements OnChanges {
  @Input() isCollapsed = false;
  @Input() height = 200;
  @Output() stickyStateChange = new EventEmitter<{isSticky: boolean, height: number}>();

  // Chat messages
  public readonly chatMessages = signal<ChatMessage[]>([
    {
      id: '1',
      text: 'Welcome! How can I help you find what you\'re looking for?',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      sender: 'other',
      senderName: 'Assistant'
    },
    {
      id: '2',
      text: 'I\'m looking for some great apps to try out.',
      timestamp: new Date(Date.now() - 180000), // 3 minutes ago
      sender: 'user'
    },
    {
      id: '3',
      text: 'Great! I can help you discover amazing applications. What type of apps are you interested in?',
      timestamp: new Date(Date.now() - 120000), // 2 minutes ago
      sender: 'other',
      senderName: 'Assistant'
    }
  ]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isCollapsed'] || changes['height']) {
      this.emitStickyState();
    }
  }

  private emitStickyState(): void {
    this.stickyStateChange.emit({
      isSticky: !this.isCollapsed,
      height: this.isCollapsed ? 0 : this.height
    });
  }
}
