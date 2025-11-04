export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export class UndoManager<T> {
  private state: HistoryState<T>;
  private maxHistory: number;

  constructor(initial: T, maxHistory = 50) {
    this.state = { past: [], present: initial, future: [] };
    this.maxHistory = maxHistory;
  }

  getPresent(): T {
    return this.state.present;
  }

  canUndo(): boolean {
    return this.state.past.length > 0;
  }

  canRedo(): boolean {
    return this.state.future.length > 0;
  }

  push(newPresent: T) {
    this.state = {
      past: [...this.state.past, this.state.present].slice(-this.maxHistory),
      present: newPresent,
      future: [],
    };
  }

  undo(): T | null {
    if (!this.canUndo()) return null;
    const previous = this.state.past[this.state.past.length - 1];
    this.state = {
      past: this.state.past.slice(0, -1),
      present: previous,
      future: [this.state.present, ...this.state.future],
    };
    return this.state.present;
  }

  redo(): T | null {
    if (!this.canRedo()) return null;
    const next = this.state.future[0];
    this.state = {
      past: [...this.state.past, this.state.present],
      present: next,
      future: this.state.future.slice(1),
    };
    return this.state.present;
  }

  clear() {
    this.state = { past: [], present: this.state.present, future: [] };
  }
}
