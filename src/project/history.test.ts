import { describe, expect, it } from 'vitest';
import { History } from './history.ts';

describe('History', () => {
  it('has nothing to undo or redo at the start', () => {
    const history = new History('a');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('undoes changes one at a time, most recent first', () => {
    const history = new History('a');
    history.record('b');
    history.record('c');
    expect(history.undo()).toBe('b');
    expect(history.undo()).toBe('a');
    expect(history.undo()).toBeNull();
  });

  it('redoes what was undone, in order', () => {
    const history = new History('a');
    history.record('b');
    history.record('c');
    history.undo();
    history.undo();
    expect(history.redo()).toBe('b');
    expect(history.redo()).toBe('c');
    expect(history.redo()).toBeNull();
  });

  it('can go back and forth any number of times', () => {
    const history = new History('a');
    history.record('b');
    for (let i = 0; i < 5; i++) {
      expect(history.undo()).toBe('a');
      expect(history.redo()).toBe('b');
    }
  });

  it('does not count a state equal to the current one as a change', () => {
    const history = new History('a');
    history.record('a');
    expect(history.canUndo).toBe(false);
    history.record('b');
    history.record('b');
    expect(history.undo()).toBe('a');
    expect(history.canUndo).toBe(false);
  });

  it('drops what could be redone once a new change is made', () => {
    const history = new History('a');
    history.record('b');
    history.undo();
    history.record('c');
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBe('a');
  });

  it('keeps redo available when the state after an undo is recorded again', () => {
    const history = new History('a');
    history.record('b');
    history.undo();
    history.record('a');
    expect(history.redo()).toBe('b');
  });

  it('forgets the oldest steps past its limit but keeps the recent ones', () => {
    const history = new History('0');
    for (let i = 1; i <= 500; i++) history.record(String(i));
    let steps = 0;
    let last: string | null = null;
    for (let state = history.undo(); state !== null; state = history.undo()) {
      steps++;
      last = state;
    }
    expect(steps).toBe(200);
    expect(last).toBe('300');
  });

  it('starts over from a new state when reset', () => {
    const history = new History('a');
    history.record('b');
    history.undo();
    history.reset('z');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    history.record('y');
    expect(history.undo()).toBe('z');
  });
});
