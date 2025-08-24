export class TimedQueue<T> {

  public get entries() { return this.queue }

  private queue: Array<{ id: number; item: T; timeout: number }> = [];
  private nextId = 1;

  constructor(
    private readonly _window: Window
  ) { }

  enqueue(item: T, timeout: number): number {
    const id = this.nextId++;
    const timeoutId = this._window.setTimeout(() => {
      this.dequeue(id);
    }, timeout);
    
    this.queue.push({ id, item, timeout: timeoutId });
    return id;
  }

  dequeue(id: number): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.queue[index];
      this._window.clearTimeout(item.timeout);
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.queue.forEach(item => this._window.clearTimeout(item.timeout));
    this.queue = [];
  }

  get size(): number {
    return this.queue.length;
  }
}




