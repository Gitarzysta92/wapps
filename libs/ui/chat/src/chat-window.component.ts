import { ChangeDetectionStrategy, Component, input, signal, computed, effect, ElementRef, ViewChild, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'user' | 'other';
  senderName?: string;
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
})
export class ChatWindowComponent implements AfterViewInit {
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  public readonly messages = input<ChatMessage[]>([]);
  public readonly currentUser = input<string>('You');
  public readonly otherUser = input<string>('Other User');

  public readonly animatedMessages = signal<ChatMessage[]>([]);
  public readonly typingMessage = signal<string>('');

  constructor() {
    // Watch for new messages and animate them
    effect(() => {
      const currentMessages = this.messages();
      const animatedMessages = this.animatedMessages();
      
      // Check if there are new messages
      if (currentMessages.length > animatedMessages.length) {
        const newMessages = currentMessages.slice(animatedMessages.length);
        
        // Add messages one by one with delay
        newMessages.forEach((message, index) => {
          setTimeout(() => {
            if (message.sender === 'other') {
              // For other messages, start typing animation
              this.animateTyping(message);
            } else {
              // For user messages, add immediately
              this.animatedMessages.update(msgs => [...msgs, message]);
              // Scroll to bottom after adding user message
              setTimeout(() => this.scrollToBottom(), 100);
            }
          }, index * 100);
        });
      }
    });
  }

  ngAfterViewInit(): void {
    // Initial scroll to bottom
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private animateTyping(message: ChatMessage): void {
    const fullText = message.text;
    let currentText = '';
    let index = 0;
    
    this.typingMessage.set(message.id);
    
    const typeInterval = setInterval(() => {
      if (index < fullText.length) {
        currentText += fullText[index];
        index++;
      } else {
        clearInterval(typeInterval);
        // Add the complete message to animated messages
        this.animatedMessages.update(msgs => [...msgs, message]);
        this.typingMessage.set('');
        // Scroll to bottom after typing is complete
        setTimeout(() => this.scrollToBottom(), 100);
      }
    }, 30); // 30ms per character for smooth typing
  }



  public formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  }

  public isTyping(messageId: string): boolean {
    return this.typingMessage() === messageId;
  }

  public getCurrentTimestamp(): Date {
    return new Date();
  }
}
