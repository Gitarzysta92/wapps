export interface ITimer {
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export const defaultTimer: ITimer = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => globalThis.clearTimeout(id as unknown as number),
};


export class TimedQueue<T> {

  public get entries() { return this.queue }

  private queue: Array<{ id: number; item: T; timeout: number }> = [];
  private nextId = 1;

  constructor(
    private readonly _timer: ITimer = defaultTimer
  ) { }

  enqueue(item: T, timeout: number): number {
    const id = this.nextId++;
    const timeoutId = this._timer.setTimeout(() => {
      this.dequeue(id);
    }, timeout);
    
    this.queue.push({ id, item, timeout: timeoutId });
    return id;
  }

  dequeue(id: number): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.queue[index];
      this._timer.clearTimeout(item.timeout);
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.queue.forEach(item => this._timer.clearTimeout(item.timeout));
    this.queue = [];
  }

  get size(): number {
    return this.queue.length;
  }
}




