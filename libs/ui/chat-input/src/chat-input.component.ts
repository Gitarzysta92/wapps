import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output, ViewChild, ElementRef, signal, computed, AfterViewInit, OnDestroy } from "@angular/core";

@Component({
  selector: 'chat-input',
  imports: [CommonModule],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInputComponent implements AfterViewInit, OnDestroy {
  @ViewChild('inputElement', { static: false }) inputElement!: ElementRef<HTMLDivElement>;

  // Input properties
  public readonly placeholder = input<string>('Type a message…');
  public readonly initialValue = input<string | null>(null);
  public readonly disabled = input<boolean>(false);
  public readonly minHeight = input<number>(48);
  public readonly maxHeight = input<number>(200);

  // Output events
  public readonly onSubmit = output<string>();
  public readonly onContentChange = output<string>();
  public readonly onFocus = output<boolean>();

  // Internal state
  private readonly _content = signal<string>('');
  private readonly _isFocused = signal<boolean>(false);
  private readonly _isSubmitting = signal<boolean>(false);
  
  // Computed properties
  public readonly hasContent = computed(() => this._content().trim().length > 0);
  public readonly isFocused = computed(() => this._isFocused());
  public readonly canSubmit = computed(() => this.hasContent() && !this.disabled() && !this._isSubmitting());

  ngAfterViewInit(): void {
    // Initialize the contenteditable div with initial value if present
    if (this.initialValue() && this.inputElement) {
      this.inputElement.nativeElement.textContent = this.initialValue();
      this._content.set(this.initialValue() || '');
      this.autoResize(this.inputElement.nativeElement);
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  // Event handlers
  public onInput(event: Event): void {
    const target = event.target as HTMLDivElement;
    const content = target.textContent || '';
    this._content.set(content);
    
    // Auto-resize functionality
    this.autoResize(target);
    
    // Emit content change
    this.onContentChange.emit(content);
  }

  public onKeyDown(event: KeyboardEvent): void {
    // Handle Enter key
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        // Allow Shift+Enter for new lines
        return;
      } else {
        // Submit on Enter (without Shift)
        event.preventDefault();
        this.submit();
      }
    }
  }

  public onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    
    // Get plain text from clipboard
    const text = event.clipboardData?.getData('text/plain') || '';
    
    // Insert text at cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      
      // Move cursor to end of inserted text
      range.setStartAfter(range.endContainer);
      range.setEndAfter(range.endContainer);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Update content and trigger auto-resize
      const target = event.target as HTMLDivElement;
      this._content.set(target.textContent || '');
      this.autoResize(target);
      this.onContentChange.emit(target.textContent || '');
    }
  }

  public handleFocusChange(focused: boolean): void {
    this._isFocused.set(focused);
    this.onFocus.emit(focused);
  }

  public onSendClick(): void {
    this.submit();
  }

  // Private methods
  private submit(): void {
    const content = this._content().trim();
    if (content && this.canSubmit()) {
      this._isSubmitting.set(true);
      this.onSubmit.emit(content);
      
      // Clear the input after submission
      this.clearInput();
      
      // Reset submitting state after a short delay
      setTimeout(() => {
        this._isSubmitting.set(false);
      }, 100);
    }
  }

  private clearInput(): void {
    if (this.inputElement) {
      this.inputElement.nativeElement.textContent = '';
      this._content.set('');
      this.autoResize(this.inputElement.nativeElement);
      this.onContentChange.emit('');
    }
  }

  private autoResize(element: HTMLDivElement): void {
    // Reset height to auto to get the correct scrollHeight
    element.style.height = 'auto';
    
    // Set height to scrollHeight, with min and max constraints
    const minHeight = this.minHeight();
    const maxHeight = this.maxHeight();
    const scrollHeight = element.scrollHeight;
    
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    element.style.height = `${newHeight}px`;
    
    // Handle overflow
    if (scrollHeight > maxHeight) {
      element.style.overflowY = 'auto';
    } else {
      element.style.overflowY = 'hidden';
    }
  }

  // Public methods for external control
  public focus(): void {
    if (this.inputElement) {
      this.inputElement.nativeElement.focus();
    }
  }

  public setValue(value: string): void {
    if (this.inputElement) {
      this.inputElement.nativeElement.textContent = value;
      this._content.set(value);
      this.autoResize(this.inputElement.nativeElement);
      this.onContentChange.emit(value);
    }
  }

  public getValue(): string {
    return this._content();
  }

  public clear(): void {
    this.clearInput();
  }
}