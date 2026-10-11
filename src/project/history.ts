/** How many steps back can be undone before the oldest are forgotten. */
const LIMIT = 200;

/**
 * Undo and redo over whole saved states of the project. Every change, of any
 * kind, is one step: the caller records the state after each change and gets
 * back the state to return to.
 */
export class History {
  private past: string[] = [];
  private future: string[] = [];
  private present: string;

  constructor(initial: string) {
    this.present = initial;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Notes the state the project is in now. A state equal to the last one is
   * not a change and adds no step. A real change drops whatever could be redone.
   */
  record(state: string): void {
    if (state === this.present) return;
    this.past.push(this.present);
    if (this.past.length > LIMIT) this.past.shift();
    this.present = state;
    this.future = [];
  }

  /** Steps back one change and returns the state to show, or null when there is nothing to undo. */
  undo(): string | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(this.present);
    this.present = previous;
    return previous;
  }

  /** Steps forward again after an undo, or returns null when there is nothing to redo. */
  redo(): string | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.present);
    this.present = next;
    return next;
  }

  /** Forgets every step and starts over from this state, as when another project is opened. */
  reset(state: string): void {
    this.past = [];
    this.future = [];
    this.present = state;
  }
}
